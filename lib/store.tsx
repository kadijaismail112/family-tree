"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ConfirmationType,
  DetailKey,
  EditRecord,
  Gender,
  RelationKind,
  Person,
  PersonComment,
  PersonPhoto,
  Relationship,
  RelationType,
  Store,
  User,
} from "./types";
import { buildSeed, CURRENT_USER_ID } from "./seed";

const STORAGE_KEY = "family-tree-mvp-v2";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

export interface AddPersonInput {
  name: string;
  birthYear?: string;
  deathYear?: string;
  notes?: string;
  gender?: Gender;
  relation?: {
    anchorPersonId: string;
    // how the NEW person relates to the anchor
    kind: "parent" | "child" | "spouse" | "sibling";
    // for kind "child": optionally link a second parent in the same step
    secondParentId?: string;
  };
}

interface StoreApi {
  state: Store;
  hydrated: boolean;
  currentUser: User;

  createFamily: (name: string) => string;
  joinFamilyByCode: (code: string) => { ok: boolean; familyId?: string; error?: string };
  createInvite: (familyId: string) => string; // returns code

  addPerson: (familyId: string, input: AddPersonInput) => Person;
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
  ) => void;
  deletePerson: (personId: string) => void;
  /** add several children to the same parents in one pass */
  addChildren: (
    familyId: string,
    parentIds: string[],
    children: { name: string; birthYear?: string; gender?: Gender }[]
  ) => number;

  addRelationship: (
    familyId: string,
    fromPersonId: string,
    toPersonId: string,
    type: RelationType,
    kind?: RelationKind,
    opts?: { alsoConfirm?: boolean }
  ) => { ok: boolean; error?: string };
  /**
   * Change an existing edge in place so its confirm/dispute history is not
   * thrown away. Changing the *type* does clear reactions — people endorsed
   * a different claim — but changing only the qualifier keeps them.
   */
  updateRelationship: (
    relationshipId: string,
    patch: { type?: RelationType; kind?: RelationKind; swap?: boolean }
  ) => void;
  deleteRelationship: (relationshipId: string) => void;
  /** the family creator can remove a member; their contributions remain */
  removeMember: (familyId: string, userId: string) => void;

  // toggle semantics: reacting with your current reaction removes it
  setReaction: (relationshipId: string, type: ConfirmationType) => void;

  // "additional info" layer
  setPersonDetail: (personId: string, key: DetailKey, value: string | null) => void;
  setPersonVoice: (personId: string, dataUrl: string | null) => void;
  /** set or clear someone's portrait */
  setPersonPhoto: (personId: string, dataUrl: string | null) => void;
  addPhoto: (input: {
    personId: string;
    familyId: string;
    dataUrl: string;
    caption?: string;
    taggedPersonIds: string[];
  }) => void;
  removePhoto: (photoId: string) => void;
  addComment: (personId: string, familyId: string, text: string) => void;
  removeComment: (commentId: string) => void;

  // deny an assumed connection so it stops being offered
  dismissSuggestion: (key: string) => void;

  /** every recorded change to a person or edge, newest first */
  editsFor: (entityId: string) => EditRecord[];

  resetDemo: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

/**
 * Demo families added to the seed after someone already has saved state
 * would otherwise never appear — the seed only ever applies to a fresh
 * install. Pull in whole families that are missing, and touch nothing that
 * is already here, so anything the user has built (or deliberately deleted)
 * survives untouched.
 */
function mergeNewSeedFamilies(saved: Store): Store {
  const seed = buildSeed();
  const known = new Set(saved.families.map((f) => f.id));
  const missing = seed.families.filter((f) => !known.has(f.id));
  if (missing.length === 0) return saved;

  const ids = new Set(missing.map((f) => f.id));
  const inNew = <T extends { familyId: string }>(rows: T[]) =>
    rows.filter((r) => ids.has(r.familyId));
  const knownUsers = new Set(saved.users.map((u) => u.id));

  return {
    ...saved,
    users: [...saved.users, ...seed.users.filter((u) => !knownUsers.has(u.id))],
    families: [...saved.families, ...missing],
    memberships: [...saved.memberships, ...inNew(seed.memberships)],
    invites: [...saved.invites, ...inNew(seed.invites)],
    people: [...saved.people, ...inNew(seed.people)],
    relationships: [...saved.relationships, ...inNew(seed.relationships)],
    photos: [...saved.photos, ...inNew(seed.photos)],
    comments: [...saved.comments, ...inNew(seed.comments)],
    edits: saved.edits ?? [],
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Store>(buildSeed);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Store;
        // tolerate states saved before newer collections existed
        parsed.photos ??= [];
        parsed.comments ??= [];
        parsed.edits ??= [];
        // Birth date used to live in two places. Fold the free-text detail
        // into the first-class field and keep the year in step, so there is
        // one answer to "when were they born".
        parsed.people = parsed.people.map((p) => {
          const legacy = (p.details as Record<string, string> | undefined)?.birthDate;
          if (!legacy) return p;
          const details = { ...(p.details ?? {}) } as Record<string, string>;
          delete details.birthDate;
          return {
            ...p,
            details: details as Person["details"],
            birthDate: p.birthDate ?? legacy,
            birthYear: p.birthYear ?? legacy.slice(0, 4),
          };
        });
        parsed.families = parsed.families.map((f) => ({
          ...f,
          createdById: f.createdById ?? CURRENT_USER_ID,
        }));
        // v2 keys were bare "parentId>childId"; they now carry a type prefix
        parsed.dismissedSuggestions = (parsed.dismissedSuggestions ?? []).map((k) =>
          k.includes("|") ? k : `PARENT_OF|${k}`
        );
        setState(mergeNewSeedFamilies(parsed));
      }
    } catch {
      // corrupted storage — fall back to seed
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/unavailable — non-fatal in a mock
    }
  }, [state, hydrated]);

  const currentUser =
    state.users.find((u) => u.id === CURRENT_USER_ID) ?? state.users[0];

  const createFamily = useCallback((name: string) => {
    const familyId = uid("f");
    setState((s) => ({
      ...s,
      families: [
        ...s.families,
        { id: familyId, name, createdAt: now(), createdById: CURRENT_USER_ID },
      ],
      memberships: [
        ...s.memberships,
        { id: uid("m"), userId: CURRENT_USER_ID, familyId, joinedAt: now() },
      ],
      invites: [
        ...s.invites,
        {
          id: uid("inv"),
          code: makeInviteCode(name),
          familyId,
          createdById: CURRENT_USER_ID,
          createdAt: now(),
        },
      ],
    }));
    return familyId;
  }, []);

  const joinFamilyByCode = useCallback(
    (code: string) => {
      const invite = state.invites.find(
        (i) => i.code.toLowerCase() === code.trim().toLowerCase()
      );
      if (!invite) return { ok: false, error: "No family found for that invite code." };
      const already = state.memberships.some(
        (m) => m.userId === CURRENT_USER_ID && m.familyId === invite.familyId
      );
      if (already)
        return { ok: false, error: "You're already a member of that family.", familyId: invite.familyId };
      setState((s) => ({
        ...s,
        memberships: [
          ...s.memberships,
          { id: uid("m"), userId: CURRENT_USER_ID, familyId: invite.familyId, joinedAt: now() },
        ],
      }));
      return { ok: true, familyId: invite.familyId };
    },
    [state.invites, state.memberships]
  );

  const createInvite = useCallback(
    (familyId: string) => {
      const existing = state.invites.find((i) => i.familyId === familyId);
      if (existing) return existing.code;
      const family = state.families.find((f) => f.id === familyId);
      const code = makeInviteCode(family?.name ?? "family");
      setState((s) => ({
        ...s,
        invites: [
          ...s.invites,
          { id: uid("inv"), code, familyId, createdById: CURRENT_USER_ID, createdAt: now() },
        ],
      }));
      return code;
    },
    [state.invites, state.families]
  );

  const addPerson = useCallback((familyId: string, input: AddPersonInput) => {
    const person: Person = {
      id: uid("p"),
      familyId,
      name: input.name.trim(),
      birthYear: input.birthYear?.trim() || undefined,
      deathYear: input.deathYear?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      gender: input.gender,
      addedById: CURRENT_USER_ID, // server-side provenance in the real app
      createdAt: now(),
    };
    setState((s) => {
      let relationships = s.relationships;
      if (input.relation) {
        const { anchorPersonId, kind, secondParentId } = input.relation;
        const rel: Relationship = {
          id: uid("r"),
          familyId,
          fromPersonId: kind === "parent" ? person.id : anchorPersonId,
          toPersonId: kind === "parent" ? anchorPersonId : person.id,
          type:
            kind === "spouse"
              ? "SPOUSE_OF"
              : kind === "sibling"
                ? "SIBLING_OF"
                : "PARENT_OF",
          addedById: CURRENT_USER_ID,
          createdAt: now(),
        };
        relationships = [...relationships, rel];
        if (kind === "child" && secondParentId && secondParentId !== anchorPersonId) {
          relationships = [
            ...relationships,
            {
              id: uid("r"),
              familyId,
              fromPersonId: secondParentId,
              toPersonId: person.id,
              type: "PARENT_OF",
              addedById: CURRENT_USER_ID,
              createdAt: now(),
            },
          ];
        }
      }
      return { ...s, people: [...s.people, person], relationships };
    });
    return person;
  }, []);

  const updatePerson = useCallback(
    (
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
      setState((s) => {
        const before = s.people.find((p) => p.id === personId);
        if (!before) return s;

        const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);
        const next: Person = { ...before };
        if (patch.name !== undefined) next.name = patch.name.trim() || before.name;
        if (patch.notes !== undefined) next.notes = clean(patch.notes);
        if (patch.gender !== undefined) next.gender = patch.gender;
        if (patch.lifeStatus !== undefined) next.lifeStatus = patch.lifeStatus;
        if (patch.birthDate !== undefined) next.birthDate = clean(patch.birthDate);
        if (patch.deathDate !== undefined) next.deathDate = clean(patch.deathDate);
        if (patch.birthYear !== undefined) next.birthYear = clean(patch.birthYear);
        if (patch.deathYear !== undefined) next.deathYear = clean(patch.deathYear);

        // one source of truth: a full date always wins and sets the year
        if (next.birthDate) next.birthYear = next.birthDate.slice(0, 4);
        if (next.deathDate) next.deathYear = next.deathDate.slice(0, 4);
        // a recorded death implies they are no longer living
        if (next.deathDate || next.deathYear) next.lifeStatus = "deceased";

        const labels: Record<string, string> = {
          name: "Name",
          notes: "Notes",
          gender: "Gender",
          lifeStatus: "Status",
          birthDate: "Birth date",
          deathDate: "Death date",
          birthYear: "Birth year",
          deathYear: "Death year",
        };
        const edits: EditRecord[] = [];
        (Object.keys(labels) as (keyof Person)[]).forEach((key) => {
          const from = (before[key] ?? "") as string;
          const to = (next[key] ?? "") as string;
          if (from === to) return;
          edits.push({
            id: uid("ed"),
            familyId: before.familyId,
            entity: "person",
            entityId: personId,
            field: labels[key as string],
            from,
            to,
            userId: CURRENT_USER_ID,
            createdAt: now(),
          });
        });

        return {
          ...s,
          people: s.people.map((p) => (p.id === personId ? next : p)),
          edits: [...s.edits, ...edits],
        };
      });
    },
    []
  );

  const addChildren = useCallback(
    (
      familyId: string,
      parentIds: string[],
      children: { name: string; birthYear?: string; gender?: Gender }[]
    ) => {
      const rows = children.filter((c) => c.name.trim());
      if (rows.length === 0) return 0;
      setState((s) => {
        const people: Person[] = [];
        const relationships: Relationship[] = [];
        for (const row of rows) {
          const child: Person = {
            id: uid("p"),
            familyId,
            name: row.name.trim(),
            birthYear: row.birthYear?.trim() || undefined,
            gender: row.gender,
            addedById: CURRENT_USER_ID,
            createdAt: now(),
          };
          people.push(child);
          for (const parentId of parentIds) {
            relationships.push({
              id: uid("r"),
              familyId,
              fromPersonId: parentId,
              toPersonId: child.id,
              type: "PARENT_OF",
              addedById: CURRENT_USER_ID,
              createdAt: now(),
            });
          }
        }
        return {
          ...s,
          people: [...s.people, ...people],
          relationships: [...s.relationships, ...relationships],
        };
      });
      return rows.length;
    },
    []
  );

  const deletePerson = useCallback((personId: string) => {
    setState((s) => {
      const deadRels = s.relationships.filter(
        (r) => r.fromPersonId === personId || r.toPersonId === personId
      );
      const deadRelIds = new Set(deadRels.map((r) => r.id));
      return {
        ...s,
        people: s.people.filter((p) => p.id !== personId),
        relationships: s.relationships.filter((r) => !deadRelIds.has(r.id)),
        confirmations: s.confirmations.filter((c) => !deadRelIds.has(c.relationshipId)),
        photos: s.photos
          .filter((ph) => ph.personId !== personId)
          .map((ph) =>
            ph.taggedPersonIds.includes(personId)
              ? { ...ph, taggedPersonIds: ph.taggedPersonIds.filter((id) => id !== personId) }
              : ph
          ),
        comments: s.comments.filter((c) => c.personId !== personId),
        dismissedSuggestions: s.dismissedSuggestions.filter(
          (k) => !k.split("|").pop()!.split(">").includes(personId)
        ),
      };
    });
  }, []);

  const addRelationship = useCallback(
    (
      familyId: string,
      fromPersonId: string,
      toPersonId: string,
      type: RelationType,
      kind?: RelationKind,
      opts?: { alsoConfirm?: boolean }
    ) => {
      if (fromPersonId === toPersonId)
        return { ok: false, error: "Pick two different people." };
      const dup = state.relationships.some((r) => {
        if (r.familyId !== familyId) return false;
        const samePairSameDir =
          r.fromPersonId === fromPersonId && r.toPersonId === toPersonId;
        const samePairReversed =
          r.fromPersonId === toPersonId && r.toPersonId === fromPersonId;
        if (r.type !== type) return false;
        if (type === "PARENT_OF") return samePairSameDir;
        return samePairSameDir || samePairReversed;
      });
      if (dup) return { ok: false, error: "That connection already exists." };
      const relId = uid("r");
      setState((s) => ({
        ...s,
        relationships: [
          ...s.relationships,
          {
            id: relId,
            familyId,
            fromPersonId,
            toPersonId,
            type,
            kind,
            addedById: CURRENT_USER_ID,
            createdAt: now(),
          },
        ],
        // Asserting a connection *is* backing it, so record the author's own
        // confirmation. Otherwise a claim you made reads as "+0" — untouched
        // by anyone, including you.
        confirmations: opts?.alsoConfirm
          ? [
              ...s.confirmations,
              {
                id: uid("c"),
                relationshipId: relId,
                userId: CURRENT_USER_ID,
                type: "CONFIRM" as ConfirmationType,
                createdAt: now(),
              },
            ]
          : s.confirmations,
      }));
      return { ok: true };
    },
    [state.relationships]
  );

  const updateRelationship = useCallback(
    (
      relationshipId: string,
      patch: { type?: RelationType; kind?: RelationKind; swap?: boolean }
    ) => {
      setState((s) => {
        const before = s.relationships.find((r) => r.id === relationshipId);
        if (!before) return s;

        const next: Relationship = { ...before };
        if (patch.type !== undefined) next.type = patch.type;
        if (patch.kind !== undefined) next.kind = patch.kind;
        if (patch.swap) {
          next.fromPersonId = before.toPersonId;
          next.toPersonId = before.fromPersonId;
        }

        const nameOf = (id: string) =>
          s.people.find((p) => p.id === id)?.name ?? "someone";
        const label: Record<RelationType, string> = {
          PARENT_OF: "parent of",
          SPOUSE_OF: "spouse of",
          SIBLING_OF: "sibling of",
        };
        const edits: EditRecord[] = [];
        const note = (field: string, from: string, to: string) => {
          if (from === to) return;
          edits.push({
            id: uid("ed"),
            familyId: before.familyId,
            entity: "relationship",
            entityId: relationshipId,
            field,
            from,
            to,
            userId: CURRENT_USER_ID,
            createdAt: now(),
          });
        };
        note("Type", label[before.type], label[next.type]);
        note("Kind", before.kind ?? "", next.kind ?? "");
        if (patch.swap)
          note(
            "Direction",
            `${nameOf(before.fromPersonId)} → ${nameOf(before.toPersonId)}`,
            `${nameOf(next.fromPersonId)} → ${nameOf(next.toPersonId)}`
          );

        // Reactions endorsed a specific claim. Re-pointing the edge or
        // changing what it asserts invalidates them; a softer qualifier
        // change does not.
        const claimChanged = next.type !== before.type || !!patch.swap;

        return {
          ...s,
          relationships: s.relationships.map((r) =>
            r.id === relationshipId ? next : r
          ),
          confirmations: claimChanged
            ? s.confirmations.filter((c) => c.relationshipId !== relationshipId)
            : s.confirmations,
          edits: [...s.edits, ...edits],
        };
      });
    },
    []
  );

  const removeMember = useCallback((familyId: string, userId: string) => {
    setState((s) => ({
      ...s,
      // their memberships go; everything they contributed stays, still
      // attributed to them, because the provenance trail must not develop holes
      memberships: s.memberships.filter(
        (m) => !(m.familyId === familyId && m.userId === userId)
      ),
    }));
  }, []);

  const deleteRelationship = useCallback((relationshipId: string) => {
    setState((s) => ({
      ...s,
      relationships: s.relationships.filter((r) => r.id !== relationshipId),
      confirmations: s.confirmations.filter((c) => c.relationshipId !== relationshipId),
    }));
  }, []);

  const setReaction = useCallback((relationshipId: string, type: ConfirmationType) => {
    setState((s) => {
      const mine = s.confirmations.find(
        (c) => c.relationshipId === relationshipId && c.userId === CURRENT_USER_ID
      );
      let confirmations = s.confirmations;
      if (mine && mine.type === type) {
        // toggle off
        confirmations = confirmations.filter((c) => c.id !== mine.id);
      } else if (mine) {
        confirmations = confirmations.map((c) =>
          c.id === mine.id ? { ...c, type, createdAt: now() } : c
        );
      } else {
        confirmations = [
          ...confirmations,
          { id: uid("c"), relationshipId, userId: CURRENT_USER_ID, type, createdAt: now() },
        ];
      }
      return { ...s, confirmations };
    });
  }, []);

  const setPersonDetail = useCallback(
    (personId: string, key: DetailKey, value: string | null) => {
      setState((s) => ({
        ...s,
        people: s.people.map((p) => {
          if (p.id !== personId) return p;
          const details = { ...(p.details ?? {}) };
          if (value === null || value.trim() === "") delete details[key];
          else details[key] = value.trim();
          return { ...p, details };
        }),
      }));
    },
    []
  );

  const setPersonPhoto = useCallback((personId: string, dataUrl: string | null) => {
    setState((s) => {
      const before = s.people.find((p) => p.id === personId);
      if (!before) return s;
      return {
        ...s,
        people: s.people.map((p) =>
          p.id === personId ? { ...p, photoUrl: dataUrl ?? undefined } : p
        ),
        edits: [
          ...s.edits,
          {
            id: uid("ed"),
            familyId: before.familyId,
            entity: "person" as const,
            entityId: personId,
            field: "Profile picture",
            from: before.photoUrl ? "a photo" : "",
            to: dataUrl ? "a photo" : "",
            userId: CURRENT_USER_ID,
            createdAt: now(),
          },
        ],
      };
    });
  }, []);

  const setPersonVoice = useCallback((personId: string, dataUrl: string | null) => {
    setState((s) => ({
      ...s,
      people: s.people.map((p) =>
        p.id === personId ? { ...p, voiceNameUrl: dataUrl ?? undefined } : p
      ),
    }));
  }, []);

  const addPhoto = useCallback(
    (input: {
      personId: string;
      familyId: string;
      dataUrl: string;
      caption?: string;
      taggedPersonIds: string[];
    }) => {
      const photo: PersonPhoto = {
        id: uid("ph"),
        personId: input.personId,
        familyId: input.familyId,
        dataUrl: input.dataUrl,
        caption: input.caption?.trim() || undefined,
        taggedPersonIds: input.taggedPersonIds.filter((id) => id !== input.personId),
        addedById: CURRENT_USER_ID,
        createdAt: now(),
      };
      setState((s) => ({ ...s, photos: [...s.photos, photo] }));
    },
    []
  );

  const removePhoto = useCallback((photoId: string) => {
    setState((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== photoId) }));
  }, []);

  const addComment = useCallback((personId: string, familyId: string, text: string) => {
    const comment: PersonComment = {
      id: uid("cm"),
      personId,
      familyId,
      userId: CURRENT_USER_ID,
      text: text.trim(),
      createdAt: now(),
    };
    setState((s) => ({ ...s, comments: [...s.comments, comment] }));
  }, []);

  const removeComment = useCallback((commentId: string) => {
    setState((s) => ({
      ...s,
      comments: s.comments.filter((c) => c.id !== commentId),
    }));
  }, []);

  const dismissSuggestion = useCallback((key: string) => {
    setState((s) =>
      s.dismissedSuggestions.includes(key)
        ? s
        : { ...s, dismissedSuggestions: [...s.dismissedSuggestions, key] }
    );
  }, []);

  const editsFor = useCallback(
    (entityId: string) =>
      state.edits
        .filter((e) => e.entityId === entityId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [state.edits]
  );

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    skipPersist.current = true;
    setState(buildSeed());
  }, []);

  const api: StoreApi = {
    state,
    hydrated,
    currentUser,
    createFamily,
    joinFamilyByCode,
    createInvite,
    addPerson,
    updatePerson,
    deletePerson,
    addChildren,
    addRelationship,
    updateRelationship,
    deleteRelationship,
    removeMember,
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
    resetDemo,
  };

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
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
