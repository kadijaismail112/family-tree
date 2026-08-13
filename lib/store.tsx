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
  ConfirmationType,
  DetailKey,
  EditRecord,
  Gender,
  Person,
  RelationKind,
  RelationType,
  Store,
  User,
} from "./types";
import { createClient } from "@/lib/supabase/client";
import { EMPTY_STORE, loadStore } from "@/lib/supabase/load";
import {
  emptyToNull,
  friendlyError,
  mapPerson,
  toDbConfirmation,
  toDbRelationType,
  yearToDb,
} from "@/lib/supabase/map";
import { sourceToBlob, uploadFamilyFile } from "@/lib/supabase/media";
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
          .select("code")
          .single();
        if (!error && data) {
          await refresh();
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
    [refresh, state.families, userId]
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
      if (input.relation) {
        const { anchorPersonId, kind, secondParentId } = input.relation;
        const type: RelationType =
          kind === "spouse" ? "SPOUSE_OF" : kind === "sibling" ? "SIBLING_OF" : "PARENT_OF";
        const fromPersonId = kind === "parent" ? data.id : anchorPersonId;
        const toPersonId = kind === "parent" ? anchorPersonId : data.id;
        const { error: linkError } = await supabase.from("relationships").insert({
          family_id: familyId,
          from_person_id: fromPersonId,
          to_person_id: toPersonId,
          type: toDbRelationType(type),
        });
        if (linkError) linkFailure = friendlyError(linkError.message, linkError.code);

        if (
          !linkFailure &&
          kind === "child" &&
          secondParentId &&
          secondParentId !== anchorPersonId
        ) {
          const { error: coParentError } = await supabase.from("relationships").insert({
            family_id: familyId,
            from_person_id: secondParentId,
            to_person_id: data.id,
            type: "parent_of",
          });
          if (coParentError) {
            linkFailure = `${data.name} was added and linked to one parent, but the second parent couldn't be connected: ${friendlyError(coParentError.message, coParentError.code)}`;
          }
        }
      }

      await refresh();
      if (linkFailure) {
        throw new Error(
          linkFailure.includes("second parent")
            ? linkFailure
            : `${data.name} was added, but the connection couldn't be saved: ${linkFailure}`
        );
      }
      return mapPerson(data, new Map());
    },
    [refresh]
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
      const { error } = await supabase.from("people").update(row).eq("id", personId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh]
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
      await refresh();
      return data?.length ?? rows.length;
    },
    [refresh]
  );

  const deletePerson = useCallback(
    async (personId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("people").delete().eq("id", personId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh]
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
        .select("id")
        .single();
      if (error || !data) {
        return { ok: false, error: friendlyError(error?.message ?? "Couldn't create that connection.", error?.code) };
      }
      if (opts?.alsoConfirm) {
        await supabase.rpc("set_reaction", {
          p_relationship_id: data.id,
          p_type: "confirm",
        });
      }
      await refresh();
      return { ok: true };
    },
    [refresh]
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
      const { error } = await supabase
        .from("relationships")
        .update(row)
        .eq("id", relationshipId);
      if (error) throw new Error(friendlyError(error.message, error.code));
      await refresh();
    },
    [refresh, state.relationships]
  );

  const removeMember = useCallback(
    async (familyId: string, memberId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("remove_member", {
        p_family_id: familyId,
        p_user_id: memberId,
      });
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh]
  );

  const claimPerson = useCallback(
    async (personId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("claim_person", {
        p_person_id: personId,
      });
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh]
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
      const { error } = await supabase
        .from("people")
        .update({ account_user_id: null })
        .eq("id", personId)
        .eq("account_user_id", userId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh, userId]
  );

  const deleteRelationship = useCallback(
    async (relationshipId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("relationships")
        .delete()
        .eq("id", relationshipId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh]
  );

  const setReaction = useCallback(
    async (relationshipId: string, type: ConfirmationType) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_reaction", {
        p_relationship_id: relationshipId,
        p_type: toDbConfirmation(type),
      });
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh]
  );

  const setPersonDetail = useCallback(
    async (personId: string, key: DetailKey, value: string | null) => {
      const person = requirePerson(state.people, personId);
      const details = { ...(person.details ?? {}) };
      if (value === null || value.trim() === "") delete details[key];
      else details[key] = value.trim();
      const supabase = createClient();
      const { error } = await supabase
        .from("people")
        .update({ details })
        .eq("id", personId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh, state.people]
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
      const { error } = await supabase
        .from("people")
        .update({ photo_path })
        .eq("id", personId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh, state.people]
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
      const { error } = await supabase
        .from("people")
        .update({ voice_name_path })
        .eq("id", personId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh, state.people]
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
        .select("id")
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
      await refresh();
      if (tagFailure) {
        throw new Error(`The photo was saved, but the tags weren't: ${tagFailure}`);
      }
    },
    [refresh]
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
      await refresh();
    },
    [refresh]
  );

  const addComment = useCallback(
    async (personId: string, familyId: string, text: string) => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase.from("comments").insert({
        person_id: personId,
        family_id: familyId,
        user_id: userId,
        body: text.trim(),
      });
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh, userId]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw new Error(friendlyError(error.message));
      await refresh();
    },
    [refresh]
  );

  const dismissSuggestion = useCallback(
    async (familyId: string, key: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("dismissed_suggestions").insert({
        family_id: familyId,
        key,
        dismissed_by: userId,
      });
      if (error && error.code !== "23505") {
        throw new Error(friendlyError(error.message, error.code));
      }
      await refresh();
    },
    [refresh, userId]
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
