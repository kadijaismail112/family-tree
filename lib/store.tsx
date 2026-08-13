"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Confirmation,
  ConfirmationType,
  DetailKey,
  EditRecord,
  Gender,
  Person,
  RelationKind,
  Relationship,
  RelationType,
  Store,
  User,
} from "./types";
import { createClient } from "@/lib/supabase/client";
import { EMPTY_STORE, loadStore } from "@/lib/supabase/load";
import {
  emptyToNull,
  friendlyError,
  mapComment,
  mapEdit,
  mapInvite,
  mapPerson,
  mapPhoto,
  mapRelationship,
  toDbConfirmation,
  toDbRelationType,
  yearToDb,
} from "@/lib/supabase/map";
import { signedUrlMap, sourceToBlob, uploadFamilyFile } from "@/lib/supabase/media";
import { colorFor } from "./helpers";
import type { Database } from "./database.types";

export interface AddPersonInput {
  name: string;
  birthYear?: string;
  deathYear?: string;
  notes?: string;
  gender?: Gender;
  relation?: {
    anchorPersonId: string;
    kind: "parent" | "child" | "spouse" | "sibling";
    secondParentId?: string;
  };
}

interface StoreApi {
  state: Store;
  hydrated: boolean;
  loadError: string | null;
  currentUser: User | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;

  createFamily: (name: string) => Promise<string>;
  joinFamilyByCode: (
    code: string
  ) => Promise<{ ok: boolean; familyId?: string; error?: string }>;
  peekInvite: (
    code: string
  ) => Promise<{ familyId: string; familyName: string; memberCount: number } | null>;
  createInvite: (familyId: string) => Promise<string>;

  addPerson: (familyId: string, input: AddPersonInput) => Promise<Person>;
  updatePerson: (
    personId: string,
    patch: Partial<
      Pick<
        Person,
        | "name"
        | "birthYear"
        | "deathYear"
        | "birthDate"
        | "deathDate"
        | "lifeStatus"
        | "gender"
        | "notes"
      >
    >
  ) => Promise<void>;
  deletePerson: (personId: string) => Promise<void>;
  addChildren: (
    familyId: string,
    parentIds: string[],
    children: { name: string; birthYear?: string; gender?: Gender }[]
  ) => Promise<number>;

  addRelationship: (
    familyId: string,
    fromPersonId: string,
    toPersonId: string,
    type: RelationType,
    kind?: RelationKind,
    opts?: { alsoConfirm?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  updateRelationship: (
    relationshipId: string,
    patch: { type?: RelationType; kind?: RelationKind; swap?: boolean }
  ) => Promise<void>;
  deleteRelationship: (relationshipId: string) => Promise<void>;
  removeMember: (familyId: string, userId: string) => Promise<void>;
  claimPerson: (personId: string) => Promise<void>;
  unclaimPerson: (personId: string) => Promise<void>;

  setReaction: (relationshipId: string, type: ConfirmationType) => Promise<void>;
  setPersonDetail: (
    personId: string,
    key: DetailKey,
    value: string | null
  ) => Promise<void>;
  setPersonVoice: (personId: string, dataUrl: string | null) => Promise<void>;
  setPersonPhoto: (personId: string, dataUrl: string | null) => Promise<void>;
  addPhoto: (input: {
    personId: string;
    familyId: string;
    dataUrl: string;
    caption?: string;
    taggedPersonIds: string[];
  }) => Promise<void>;
  removePhoto: (photoId: string) => Promise<void>;
  addComment: (personId: string, familyId: string, text: string) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  dismissSuggestion: (familyId: string, key: string) => Promise<void>;
  editsFor: (entityId: string) => EditRecord[];
}

const StoreContext = createContext<StoreApi | null>(null);

// Reached when the thing being edited has been deleted by another member (or
// in another tab) since this view was rendered. Returning quietly instead
// would let the caller announce a save that never happened.
const STALE_VIEW =
  "That's no longer here — someone may have changed it. Refresh to see the latest.";

function requirePerson(people: Person[], personId: string) {
  const person = people.find((p) => p.id === personId);
  if (!person) throw new Error(STALE_VIEW);
  return person;
}

/**
 * Every mutation used to end in `refresh()` — a reload of all twelve tables
 * before the click showed anything, measured at ~500ms per tap for a write
 * that itself took 233ms. Writes now return the rows they touched and those
 * rows are spliced in, so the wait is the write alone.
 *
 * The database stays the only authority on what landed: apart from the
 * clearly-marked optimistic toggles, nothing here writes state the server
 * hasn't confirmed, and the toggles put the old value back when it refuses.
 * Cascades are mirrored by hand — a deleted person takes their edges with
 * them here exactly as the foreign keys do there.
 */
function upsert<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = row;
  return next;
}

function without<T extends { id: string }>(list: T[], ids: string | Set<string>): T[] {
  const set = typeof ids === "string" ? new Set([ids]) : ids;
  return list.filter((x) => !set.has(x.id));
}

/**
 * A person row carries storage *paths*; the URLs that display them are signed
 * once at load. Re-mapping a row without them would blank someone's portrait
 * on an unrelated edit, so an unchanged path keeps the URL already in hand.
 */
function personFromRow(
  row: Database["public"]["Tables"]["people"]["Row"],
  prev?: Person,
  urls: Map<string, string> = new Map()
): Person {
  const mapped = mapPerson(row, urls);
  return {
    ...mapped,
    photoUrl: mapped.photoUrl ?? (row.photo_path ? prev?.photoUrl : undefined),
    voiceNameUrl:
      mapped.voiceNameUrl ?? (row.voice_name_path ? prev?.voiceNameUrl : undefined),
  };
}

function makeInviteCode(name: string) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")[0]
    .slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug || "FAMILY"}-${suffix}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Store>(EMPTY_STORE);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authFallback, setAuthFallback] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const next = await loadStore(supabase);
    setState(next);
    setLoadError(null);
  }, []);

  /**
   * The audit rows are written by a trigger, so an edit's history entry only
   * exists once the write lands. This pulls the trail for the one thing that
   * changed — it is never awaited by the caller, because the panel has
   * already repainted and a history line arriving a moment later costs
   * nobody anything.
   */
  const syncEdits = useCallback(async (entityId: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("edits").select("*").eq("entity_id", entityId);
    if (!data) return;
    setState((s) => ({
      ...s,
      edits: [...s.edits.filter((e) => e.entityId !== entityId), ...data.map(mapEdit)],
    }));
  }, []);

  // Who the loaded store belongs to. Supabase re-announces SIGNED_IN whenever
  // the tab regains focus; without this, coming back to the tab would refetch
  // the whole tree and flash the canvas for no reason.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      const id = session?.user.id ?? null;
      setUserId(id);
      if (!session || !id) {
        loadedFor.current = null;
        setState(EMPTY_STORE);
        setAuthFallback(null);
        setHydrated(true);
        return;
      }
      if (loadedFor.current === id) return;
      loadedFor.current = id;
      const user = session.user;
      const meta = user.user_metadata as { display_name?: string };
      setAuthFallback({
        id,
        name: meta.display_name || user.email?.split("@")[0] || "You",
        email: user.email ?? "",
        color: colorFor(id),
      });
      loadStore(supabase)
        .then((next) => {
          setState(next);
          setLoadError(null);
        })
        .catch((err: Error) => {
          // Let the next auth event retry rather than leaving the tab stuck
          // on an error until it is reloaded by hand.
          loadedFor.current = null;
          setLoadError(err.message);
          setState(EMPTY_STORE);
        })
        .finally(() => setHydrated(true));
    });
    return () => subscription.unsubscribe();
  }, []);

  const currentUser = useMemo(() => {
    if (!userId) return null;
    return state.users.find((u) => u.id === userId) ?? authFallback;
  }, [state.users, userId, authFallback]);

  const createFamily = useCallback(
    async (name: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_family", {
        p_name: name,
      });
      if (error || !data) throw new Error(friendlyError(error?.message ?? "Couldn't create that family."));
      await refresh();
      return data;
    },
    [refresh]
  );

  const joinFamilyByCode = useCallback(
    async (code: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("accept_invite", {
        p_code: code.trim(),
      });
      if (error || !data) {
        return {
          ok: false,
          error: friendlyError(error?.message ?? "No family found for that invite code."),
        };
      }
      await refresh();
      return { ok: true, familyId: data };
    },
    [refresh]
  );

  const peekInvite = useCallback(async (code: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("peek_invite", {
      p_code: code.trim(),
    });
    // No rows means no such invite. An error means we don't know yet, and the
    // caller must be able to tell those apart before telling someone their
    // invite is dead.
    if (error) throw new Error(friendlyError(error.message));
    if (!data?.[0]) return null;
    const row = data[0];
    return {
      familyId: row.family_id,
      familyName: row.family_name,
      memberCount: Number(row.member_count),
    };
  }, []);

  const createInvite = useCallback(
    async (familyId: string) => {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("invites")
        .select("code")
        .eq("family_id", familyId)
        .eq("revoked", false)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing?.code) return existing.code;

      const family = state.families.find((f) => f.id === familyId);
      let lastError = "Couldn't create an invite code.";
      for (let i = 0; i < 5; i++) {
        const code = makeInviteCode(family?.name ?? "family");
        const { data, error } = await supabase
          .from("invites")
          .insert({ family_id: familyId, code, created_by: userId })
          .select()
          .single();
        if (!error && data) {
          setState((s) => ({ ...s, invites: upsert(s.invites, mapInvite(data)) }));
          return data.code;
        }
        // Only a code collision is worth another spin of the loop; anything
        // else will fail identically five times and hide the real reason.
        if (error && error.code !== "23505") {
          throw new Error(friendlyError(error.message, error.code));
        }
        if (error) lastError = friendlyError(error.message, error.code);
      }
      throw new Error(lastError);
    },
    [state.families, userId]
  );

  const addPerson = useCallback(
    async (familyId: string, input: AddPersonInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("people")
        .insert({
          family_id: familyId,
          name: input.name.trim(),
          birth_year: yearToDb(input.birthYear),
          death_year: yearToDb(input.deathYear),
          notes: emptyToNull(input.notes),
          gender: input.gender ?? null,
        })
        .select()
        .single();
      if (error || !data) throw new Error(friendlyError(error?.message ?? "Couldn't add that person."));

      // The person exists now even if the edge that was supposed to attach
      // them doesn't. Reporting success regardless would leave someone
      // floating in the tree with nobody noticing, so the failure is kept and
      // raised after the refresh — by which point they can see who to connect.
      let linkFailure: string | null = null;
      const newEdges: Relationship[] = [];
      if (input.relation) {
        const { anchorPersonId, kind, secondParentId } = input.relation;
        const type: RelationType =
          kind === "spouse" ? "SPOUSE_OF" : kind === "sibling" ? "SIBLING_OF" : "PARENT_OF";
        const fromPersonId = kind === "parent" ? data.id : anchorPersonId;
        const toPersonId = kind === "parent" ? anchorPersonId : data.id;
        const { data: edge, error: linkError } = await supabase
          .from("relationships")
          .insert({
            family_id: familyId,
            from_person_id: fromPersonId,
            to_person_id: toPersonId,
            type: toDbRelationType(type),
          })
          .select()
          .single();
        if (linkError) linkFailure = friendlyError(linkError.message, linkError.code);
        else if (edge) newEdges.push(mapRelationship(edge));

        if (
          !linkFailure &&
          kind === "child" &&
          secondParentId &&
          secondParentId !== anchorPersonId
        ) {
          const { data: coEdge, error: coParentError } = await supabase
            .from("relationships")
            .insert({
              family_id: familyId,
              from_person_id: secondParentId,
              to_person_id: data.id,
              type: "parent_of",
            })
            .select()
            .single();
          if (coParentError) {
            linkFailure = `${data.name} was added and linked to one parent, but the second parent couldn't be connected: ${friendlyError(coParentError.message, coParentError.code)}`;
          } else if (coEdge) newEdges.push(mapRelationship(coEdge));
        }
      }

      const person = personFromRow(data);
      setState((s) => ({
        ...s,
        people: upsert(s.people, person),
        relationships: newEdges.reduce(upsert, s.relationships),
      }));

      if (linkFailure) {
        throw new Error(
          linkFailure.includes("second parent")
            ? linkFailure
            : `${data.name} was added, but the connection couldn't be saved: ${linkFailure}`
        );
      }
      return person;
    },
    []
  );

  const updatePerson = useCallback(
    async (
      personId: string,
      patch: Partial<
        Pick<
          Person,
          | "name"
          | "birthYear"
          | "deathYear"
          | "birthDate"
          | "deathDate"
          | "lifeStatus"
          | "gender"
          | "notes"
        >
      >
    ) => {
      const row: Database["public"]["Tables"]["people"]["Update"] = {};
      if (patch.name !== undefined) row.name = patch.name.trim();
      if (patch.notes !== undefined) row.notes = emptyToNull(patch.notes);
      if (patch.gender !== undefined) row.gender = patch.gender ?? null;
      if (patch.lifeStatus !== undefined) row.life_status = patch.lifeStatus ?? null;
      if (patch.birthDate !== undefined) row.birth_date = emptyToNull(patch.birthDate);
      if (patch.deathDate !== undefined) row.death_date = emptyToNull(patch.deathDate);
      if (patch.birthYear !== undefined) row.birth_year = yearToDb(patch.birthYear);
      if (patch.deathYear !== undefined) row.death_year = yearToDb(patch.deathYear);

      const supabase = createClient();
      const { data, error } = await supabase
        .from("people")
        .update(row)
        .eq("id", personId)
        .select()
        .single();
      if (error) throw new Error(friendlyError(error.message));
      if (!data) throw new Error(STALE_VIEW);
      // The row comes back after the date-normalising trigger has run, so
      // what lands on screen is what the database actually stored.
      setState((s) => ({
        ...s,
        people: upsert(
          s.people,
          personFromRow(data, s.people.find((p) => p.id === personId))
        ),
      }));
      void syncEdits(personId);
    },
    [syncEdits]
  );

  const addChildren = useCallback(
    async (
      familyId: string,
      parentIds: string[],
      children: { name: string; birthYear?: string; gender?: Gender }[]
    ) => {
      const rows = children.filter((c) => c.name.trim());
      if (rows.length === 0) return 0;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("add_children", {
        p_family_id: familyId,
        p_parent_ids: parentIds,
        p_children: rows.map((c) => ({
          name: c.name.trim(),
          birth_year: c.birthYear?.trim() || "",
          gender: c.gender || "",
        })),
      });
      if (error) throw new Error(friendlyError(error.message));
      const ids = data ?? [];
      if (ids.length > 0) {
        // Two narrow reads for the rows just created, rather than a reload of
        // everything to find them.
        const [{ data: kids }, { data: edges }] = await Promise.all([
          supabase.from("people").select("*").in("id", ids),
          supabase.from("relationships").select("*").in("to_person_id", ids),
        ]);
        setState((s) => ({
          ...s,
          people: (kids ?? []).map((r) => personFromRow(r)).reduce(upsert, s.people),
          relationships: (edges ?? []).map(mapRelationship).reduce(upsert, s.relationships),
        }));
      }
      return ids.length || rows.length;
    },
    []
  );

  const deletePerson = useCallback(
    async (personId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("people").delete().eq("id", personId);
      if (error) throw new Error(friendlyError(error.message));
      // Foreign keys cascade in the database; the same removals are mirrored
      // here so the canvas doesn't keep drawing edges to someone who is gone.
      setState((s) => {
        const goneEdges = new Set(
          s.relationships
            .filter((r) => r.fromPersonId === personId || r.toPersonId === personId)
            .map((r) => r.id)
        );
        const gonePhotos = new Set(
          s.photos.filter((ph) => ph.personId === personId).map((ph) => ph.id)
        );
        return {
          ...s,
          people: without(s.people, personId),
          relationships: without(s.relationships, goneEdges),
          confirmations: s.confirmations.filter((c) => !goneEdges.has(c.relationshipId)),
          photos: without(s.photos, gonePhotos).map((ph) =>
            ph.taggedPersonIds.includes(personId)
              ? { ...ph, taggedPersonIds: ph.taggedPersonIds.filter((id) => id !== personId) }
              : ph
          ),
          comments: s.comments.filter((c) => c.personId !== personId),
          edits: s.edits.filter(
            (e) => e.entityId !== personId && !goneEdges.has(e.entityId)
          ),
        };
      });
    },
    []
  );

  const addRelationship = useCallback(
    async (
      familyId: string,
      fromPersonId: string,
      toPersonId: string,
      type: RelationType,
      kind?: RelationKind,
      opts?: { alsoConfirm?: boolean }
    ) => {
      if (fromPersonId === toPersonId)
        return { ok: false, error: "Pick two different people." };
      const supabase = createClient();
      const { data, error } = await supabase
        .from("relationships")
        .insert({
          family_id: familyId,
          from_person_id: fromPersonId,
          to_person_id: toPersonId,
          type: toDbRelationType(type),
          kind: kind ?? null,
        })
        .select()
        .single();
      if (error || !data) {
        return { ok: false, error: friendlyError(error?.message ?? "Couldn't create that connection.", error?.code) };
      }
      let ownConfirmation: Confirmation | null = null;
      if (opts?.alsoConfirm) {
        const { error: reactError } = await supabase.rpc("set_reaction", {
          p_relationship_id: data.id,
          p_type: "confirm",
        });
        // The RPC returns nothing, so the row is reconstructed from what it
        // was just told to write. The id is local-only until the next full
        // load; nothing keys off it but React.
        if (!reactError && userId) {
          ownConfirmation = {
            id: crypto.randomUUID(),
            relationshipId: data.id,
            userId,
            type: "CONFIRM",
            createdAt: new Date().toISOString(),
          };
        }
      }
      setState((s) => ({
        ...s,
        relationships: upsert(s.relationships, mapRelationship(data)),
        confirmations: ownConfirmation
          ? upsert(s.confirmations, ownConfirmation)
          : s.confirmations,
      }));
      return { ok: true };
    },
    [userId]
  );

  const updateRelationship = useCallback(
    async (
      relationshipId: string,
      patch: { type?: RelationType; kind?: RelationKind; swap?: boolean }
    ) => {
      const before = state.relationships.find((r) => r.id === relationshipId);
      if (!before) throw new Error(STALE_VIEW);
      const row: Database["public"]["Tables"]["relationships"]["Update"] = {};
      if (patch.type !== undefined) row.type = toDbRelationType(patch.type);
      if (patch.kind !== undefined) row.kind = patch.kind;
      if (patch.swap) {
        row.from_person_id = before.toPersonId;
        row.to_person_id = before.fromPersonId;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("relationships")
        .update(row)
        .eq("id", relationshipId)
        .select()
        .single();
      if (error) throw new Error(friendlyError(error.message, error.code));
      if (!data) throw new Error(STALE_VIEW);
      const next = mapRelationship(data);
      // A trigger clears the reactions when the claim itself changes — when
      // the qualifier alone moves, they stand. Mirroring that rule here keeps
      // the tally on screen honest.
      const claimChanged =
        next.type !== before.type ||
        next.fromPersonId !== before.fromPersonId ||
        next.toPersonId !== before.toPersonId;
      setState((s) => ({
        ...s,
        relationships: upsert(s.relationships, next),
        confirmations: claimChanged
          ? s.confirmations.filter((c) => c.relationshipId !== relationshipId)
          : s.confirmations,
      }));
      void syncEdits(relationshipId);
    },
    [state.relationships, syncEdits]
  );

  const removeMember = useCallback(
    async (familyId: string, memberId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("remove_member", {
        p_family_id: familyId,
        p_user_id: memberId,
      });
      if (error) throw new Error(friendlyError(error.message));
      setState((s) => ({
        ...s,
        memberships: s.memberships.filter(
          (m) => !(m.familyId === familyId && m.userId === memberId)
        ),
      }));
    },
    []
  );

  /**
   * Optimistic: the badge moves on the tap, and the whole people list is put
   * back untouched if the server refuses. Claiming releases any node you
   * already held in that family, which is what the RPC does server-side.
   */
  const claimPerson = useCallback(
    async (personId: string) => {
      if (!userId) throw new Error("You need to be signed in for that.");
      const target = requirePerson(state.people, personId);
      const previous = state.people.find(
        (p) => p.familyId === target.familyId && p.accountUserId === userId
      );
      // Undo is written as the inverse of the change rather than as a snapshot
      // of the whole list, so a failure here can't also revert an unrelated
      // edit that landed while the request was in the air.
      const apply = (claimant: string | undefined, releaser: string | undefined) =>
        setState((s) => ({
          ...s,
          people: s.people.map((p) =>
            p.id === personId
              ? { ...p, accountUserId: claimant }
              : previous && p.id === previous.id
                ? { ...p, accountUserId: releaser }
                : p
          ),
        }));

      apply(userId, undefined);
      const supabase = createClient();
      const { error } = await supabase.rpc("claim_person", {
        p_person_id: personId,
      });
      if (error) {
        apply(target.accountUserId, userId);
        throw new Error(friendlyError(error.message));
      }
    },
    [state.people, userId]
  );

  /**
   * Claiming was one-way, so a mis-tap on "This is me" was permanent unless
   * you happened to notice you could claim a different node instead. The
   * `.eq("account_user_id", userId)` guard is the authorisation: it can only
   * ever release your own claim, never someone else's.
   */
  const unclaimPerson = useCallback(
    async (personId: string) => {
      if (!userId) throw new Error("You need to be signed in for that.");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("people")
        .update({ account_user_id: null })
        .eq("id", personId)
        .eq("account_user_id", userId)
        .select()
        .single();
      if (error) throw new Error(friendlyError(error.message));
      if (!data) throw new Error(STALE_VIEW);
      setState((s) => ({
        ...s,
        people: upsert(
          s.people,
          personFromRow(data, s.people.find((p) => p.id === personId))
        ),
      }));
    },
    [userId]
  );

  const deleteRelationship = useCallback(
    async (relationshipId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("relationships")
        .delete()
        .eq("id", relationshipId);
      if (error) throw new Error(friendlyError(error.message));
      setState((s) => ({
        ...s,
        relationships: without(s.relationships, relationshipId),
        confirmations: s.confirmations.filter(
          (c) => c.relationshipId !== relationshipId
        ),
        edits: s.edits.filter((e) => e.entityId !== relationshipId),
      }));
    },
    []
  );

  /**
   * Optimistic, and the one interaction where it matters most: confirming is
   * a tap people repeat down a list. The rule below is the RPC's own —
   * pressing your current reaction again withdraws it — so the two agree
   * without a round trip to find out.
   */
  const setReaction = useCallback(
    async (relationshipId: string, type: ConfirmationType) => {
      if (!userId) throw new Error("You need to be signed in for that.");
      const mine = state.confirmations.find(
        (c) => c.relationshipId === relationshipId && c.userId === userId
      );
      const withdrawing = mine?.type === type;
      const optimistic: Confirmation = {
        id: mine?.id ?? crypto.randomUUID(),
        relationshipId,
        userId,
        type,
        createdAt: mine?.createdAt ?? new Date().toISOString(),
      };
      setState((s) => ({
        ...s,
        confirmations: withdrawing
          ? without(s.confirmations, optimistic.id)
          : upsert(s.confirmations, optimistic),
      }));

      const supabase = createClient();
      const { error } = await supabase.rpc("set_reaction", {
        p_relationship_id: relationshipId,
        p_type: toDbConfirmation(type),
      });
      if (error) {
        // Put back exactly what was there — the row if you had one, nothing
        // if you didn't.
        setState((s) => ({
          ...s,
          confirmations: mine
            ? upsert(s.confirmations, mine)
            : without(s.confirmations, optimistic.id),
        }));
        throw new Error(friendlyError(error.message));
      }
    },
    [state.confirmations, userId]
  );

  const setPersonDetail = useCallback(
    async (personId: string, key: DetailKey, value: string | null) => {
      const person = requirePerson(state.people, personId);
      const details = { ...(person.details ?? {}) };
      if (value === null || value.trim() === "") delete details[key];
      else details[key] = value.trim();
      const supabase = createClient();
      const { data, error } = await supabase
        .from("people")
        .update({ details })
        .eq("id", personId)
        .select()
        .single();
      if (error) throw new Error(friendlyError(error.message));
      if (!data) throw new Error(STALE_VIEW);
      setState((s) => ({
        ...s,
        people: upsert(s.people, personFromRow(data, person)),
      }));
      void syncEdits(personId);
    },
    [state.people, syncEdits]
  );

  const setPersonPhoto = useCallback(
    async (personId: string, dataUrl: string | null) => {
      const person = requirePerson(state.people, personId);
      const supabase = createClient();
      let photo_path: string | null = null;
      if (dataUrl) {
        const blob = await sourceToBlob(dataUrl);
        photo_path = await uploadFamilyFile(
          supabase,
          "person-photos",
          person.familyId,
          personId,
          blob
        );
      }
      const { data, error } = await supabase
        .from("people")
        .update({ photo_path })
        .eq("id", personId)
        .select()
        .single();
      if (error) throw new Error(friendlyError(error.message));
      if (!data) throw new Error(STALE_VIEW);
      // A freshly uploaded file has no signed URL yet, so sign this one path
      // rather than re-signing every image in every family.
      const urls = photo_path
        ? await signedUrlMap(supabase, "person-photos", [photo_path])
        : new Map<string, string>();
      setState((s) => ({
        ...s,
        people: upsert(s.people, personFromRow(data, person, urls)),
      }));
      void syncEdits(personId);
    },
    [state.people, syncEdits]
  );

  const setPersonVoice = useCallback(
    async (personId: string, dataUrl: string | null) => {
      const person = requirePerson(state.people, personId);
      const supabase = createClient();
      let voice_name_path: string | null = null;
      if (dataUrl) {
        const blob = await sourceToBlob(dataUrl);
        voice_name_path = await uploadFamilyFile(
          supabase,
          "voice-names",
          person.familyId,
          personId,
          blob
        );
      }
      const { data, error } = await supabase
        .from("people")
        .update({ voice_name_path })
        .eq("id", personId)
        .select()
        .single();
      if (error) throw new Error(friendlyError(error.message));
      if (!data) throw new Error(STALE_VIEW);
      const urls = voice_name_path
        ? await signedUrlMap(supabase, "voice-names", [voice_name_path])
        : new Map<string, string>();
      setState((s) => ({
        ...s,
        people: upsert(s.people, personFromRow(data, person, urls)),
      }));
    },
    [state.people]
  );

  const addPhoto = useCallback(
    async (input: {
      personId: string;
      familyId: string;
      dataUrl: string;
      caption?: string;
      taggedPersonIds: string[];
    }) => {
      const supabase = createClient();
      const blob = await sourceToBlob(input.dataUrl);
      const storage_path = await uploadFamilyFile(
        supabase,
        "person-photos",
        input.familyId,
        input.personId,
        blob
      );
      const { data, error } = await supabase
        .from("photos")
        .insert({
          family_id: input.familyId,
          person_id: input.personId,
          storage_path,
          caption: emptyToNull(input.caption),
        })
        .select()
        .single();
      if (error || !data) throw new Error(friendlyError(error?.message ?? "Couldn't save that photo."));
      const tags = input.taggedPersonIds.filter((id) => id !== input.personId);
      let tagFailure: string | null = null;
      if (tags.length > 0) {
        const { error: tagError } = await supabase
          .from("photo_tags")
          .insert(tags.map((person_id) => ({ photo_id: data.id, person_id })));
        if (tagError) tagFailure = friendlyError(tagError.message, tagError.code);
      }
      const urls = await signedUrlMap(supabase, "person-photos", [storage_path]);
      setState((s) => ({
        ...s,
        photos: upsert(s.photos, mapPhoto(data, tagFailure ? [] : tags, urls)),
      }));
      if (tagFailure) {
        throw new Error(`The photo was saved, but the tags weren't: ${tagFailure}`);
      }
    },
    []
  );

  const removePhoto = useCallback(
    async (photoId: string) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("photos")
        .select("storage_path")
        .eq("id", photoId)
        .maybeSingle();
      const { error } = await supabase.from("photos").delete().eq("id", photoId);
      if (error) throw new Error(friendlyError(error.message));
      if (data?.storage_path) {
        await supabase.storage.from("person-photos").remove([data.storage_path]);
      }
      setState((s) => ({ ...s, photos: without(s.photos, photoId) }));
    },
    []
  );

  const addComment = useCallback(
    async (personId: string, familyId: string, text: string) => {
      if (!userId) return;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("comments")
        .insert({
          person_id: personId,
          family_id: familyId,
          user_id: userId,
          body: text.trim(),
        })
        .select()
        .single();
      if (error) throw new Error(friendlyError(error.message));
      if (data) setState((s) => ({ ...s, comments: upsert(s.comments, mapComment(data)) }));
    },
    [userId]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw new Error(friendlyError(error.message));
      setState((s) => ({ ...s, comments: without(s.comments, commentId) }));
    },
    []
  );

  const dismissSuggestion = useCallback(
    async (familyId: string, key: string) => {
      setState((s) =>
        s.dismissedSuggestions.includes(key)
          ? s
          : { ...s, dismissedSuggestions: [...s.dismissedSuggestions, key] }
      );
      const supabase = createClient();
      const { error } = await supabase.from("dismissed_suggestions").insert({
        family_id: familyId,
        key,
        dismissed_by: userId,
      });
      // A duplicate key means it was already dismissed — the state we just
      // set is correct either way.
      if (error && error.code !== "23505") {
        setState((s) => ({
          ...s,
          dismissedSuggestions: s.dismissedSuggestions.filter((k) => k !== key),
        }));
        throw new Error(friendlyError(error.message, error.code));
      }
    },
    [userId]
  );

  const editsFor = useCallback(
    (entityId: string) =>
      state.edits
        .filter((e) => e.entityId === entityId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [state.edits]
  );

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    loadedFor.current = null;
    setState(EMPTY_STORE);
    setUserId(null);
    setAuthFallback(null);
  }, []);

  const api: StoreApi = {
    state,
    hydrated,
    loadError,
    currentUser,
    refresh,
    signOut,
    createFamily,
    joinFamilyByCode,
    peekInvite,
    createInvite,
    addPerson,
    updatePerson,
    deletePerson,
    addChildren,
    addRelationship,
    updateRelationship,
    deleteRelationship,
    removeMember,
    claimPerson,
    unclaimPerson,
    setReaction,
    setPersonDetail,
    setPersonVoice,
    setPersonPhoto,
    addPhoto,
    removePhoto,
    addComment,
    removeComment,
    dismissSuggestion,
    editsFor,
  };

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
