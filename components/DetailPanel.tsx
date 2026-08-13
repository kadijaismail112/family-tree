"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  editFieldLabel,
  fileToDataUrl,
  formatDateOrYear,
  lifespan,
  timeAgo,
  userName,
} from "@/lib/helpers";
import {
  kindsFor,
  defaultKind,
  type Gender,
  type LifeStatus,
  type RelationKind,
  type RelationType,
} from "@/lib/types";
import { suggestionsFor } from "@/lib/suggestions";
import { computeKinship } from "@/lib/kinship";
import type { Person, Relationship } from "@/lib/types";
import {
  Avatar,
  DangerButton,
  Field,
  GhostButton,
  inputCls,
  PrimaryButton,
  useAction,
  useToast,
} from "./ui";
import { PersonExtras } from "./PersonExtras";

export function DetailPanel({
  selection,
  onClose,
  onSelectPerson,
  onSelectRelationship,
  onAddRelative,
  onAddChildren,
  onConnectFrom,
  mePersonId,
  meModeOn,
  onToggleMeMode,
  pathFound,
  isolatedId,
  onToggleIsolate,
  onCompare,
}: {
  selection: { kind: "person" | "relationship"; id: string };
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  onSelectRelationship: (id: string) => void;
  onAddRelative: (anchorId: string) => void;
  onAddChildren: (parentId: string) => void;
  onConnectFrom: (personId: string) => void;
  mePersonId: string | null;
  meModeOn: boolean;
  onToggleMeMode: () => void;
  pathFound: boolean;
  isolatedId: string | null;
  onToggleIsolate: (personId: string) => void;
  onCompare: (personId: string) => void;
}) {
  const { state } = useStore();

  const person =
    selection.kind === "person"
      ? state.people.find((p) => p.id === selection.id)
      : undefined;
  const relationship =
    selection.kind === "relationship"
      ? state.relationships.find((r) => r.id === selection.id)
      : undefined;

  if (!person && !relationship) return null;

  return (
    <aside className="animate-slide-in pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-t-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 sm:w-[340px] sm:rounded-2xl">
      {/* grab handle, so the sheet reads as draggable-to-dismiss on a phone */}
      <div className="flex justify-center pt-2 sm:hidden">
        <span className="h-1 w-10 rounded-full bg-stone-200" />
      </div>
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          {person ? "Person" : "Connection"}
        </span>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {person && (
          <PersonDetail
            person={person}
            onSelectRelationship={onSelectRelationship}
            onSelectPerson={onSelectPerson}
            onAddRelative={onAddRelative}
            onAddChildren={onAddChildren}
            onConnectFrom={onConnectFrom}
            onClose={onClose}
            mePersonId={mePersonId}
            meModeOn={meModeOn}
            onToggleMeMode={onToggleMeMode}
            pathFound={pathFound}
            isolatedId={isolatedId}
            onToggleIsolate={onToggleIsolate}
            onCompare={onCompare}
          />
        )}
        {relationship && (
          <RelationshipDetail
            relationship={relationship}
            onSelectPerson={onSelectPerson}
            onClose={onClose}
          />
        )}
      </div>
    </aside>
  );
}

/* ─── Person ────────────────────────────────────────────────────────── */

function PersonDetail({
  person,
  onSelectRelationship,
  onSelectPerson,
  onAddRelative,
  onAddChildren,
  onConnectFrom,
  onClose,
  mePersonId,
  meModeOn,
  onToggleMeMode,
  pathFound,
  isolatedId,
  onToggleIsolate,
  onCompare,
}: {
  person: Person;
  onSelectRelationship: (id: string) => void;
  onSelectPerson: (id: string) => void;
  onAddRelative: (anchorId: string) => void;
  onAddChildren: (parentId: string) => void;
  onConnectFrom: (personId: string) => void;
  onClose: () => void;
  mePersonId: string | null;
  meModeOn: boolean;
  onToggleMeMode: () => void;
  pathFound: boolean;
  isolatedId: string | null;
  onToggleIsolate: (personId: string) => void;
  onCompare: (personId: string) => void;
}) {
  const { state, currentUser, updatePerson, deletePerson, addRelationship, dismissSuggestion, setPersonPhoto, claimPerson } =
    useStore();
  const toast = useToast();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    birthYear: "",
    deathYear: "",
    birthDate: "",
    deathDate: "",
    notes: "",
    gender: "" as Gender | "",
    lifeStatus: "" as LifeStatus | "",
  });

  useEffect(() => {
    setEditing(false);
  }, [person.id]);

  const rels = useMemo(
    () =>
      state.relationships.filter(
        (r) => r.fromPersonId === person.id || r.toPersonId === person.id
      ),
    [state.relationships, person.id]
  );

  // inferred connections awaiting a confirm/deny
  const suggestions = useMemo(
    () =>
      suggestionsFor(
        state.relationships.filter((r) => r.familyId === person.familyId),
        state.dismissedSuggestions,
        person.id
      ),
    [state.relationships, state.dismissedSuggestions, person.id, person.familyId]
  );

  const life = lifespan(person.birthYear, person.deathYear);
  const isYou = !!currentUser && person.accountUserId === currentUser.id;
  const claimed = !!person.accountUserId;
  const marriedIn = useMemo(() => {
    const familyPeople = state.people.filter((p) => p.familyId === person.familyId);
    const familyRels = state.relationships.filter(
      (r) => r.familyId === person.familyId
    );
    return !computeKinship(familyPeople, familyRels, currentUser?.id).bloodIds.has(person.id);
  }, [state.people, state.relationships, person.familyId, person.id, currentUser?.id]);

  const startEdit = () => {
    setDraft({
      name: person.name,
      birthYear: person.birthYear ?? "",
      deathYear: person.deathYear ?? "",
      birthDate: person.birthDate ?? "",
      deathDate: person.deathDate ?? "",
      notes: person.notes ?? "",
      gender: person.gender ?? "",
      lifeStatus: person.lifeStatus ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    const saved = await run(
      () =>
        updatePerson(person.id, {
          ...draft,
          gender: draft.gender || undefined,
          lifeStatus: draft.lifeStatus || undefined,
        }),
      { success: "Details updated" }
    );
    // Keep the form open on failure so the typing isn't thrown away.
    if (saved) setEditing(false);
  };

  const relSentence = (r: Relationship) => {
    const otherId = r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId;
    const other = state.people.find((p) => p.id === otherId);
    const label =
      r.type === "SPOUSE_OF"
        ? "Spouse of"
        : r.type === "SIBLING_OF"
          ? "Sibling of"
          : r.fromPersonId === person.id
            ? "Parent of"
            : "Child of";
    return { label, other };
  };

  return (
    <div className="px-5 py-4">
      {!editing ? (
        <>
          <div className="flex items-center gap-3">
            <ProfilePicture person={person} onSet={setPersonPhoto} />
            <div className="min-w-0">
              <h3 className="font-display truncate text-lg font-semibold leading-tight text-stone-900">
                {person.name}
              </h3>
              <p className="text-sm text-stone-500">
                {formatDateOrYear(person.birthDate, life ?? undefined) ??
                  "dates unknown"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {marriedIn ? (
              <Chip tone="amber">Married in</Chip>
            ) : (
              <Chip tone="teal">Blood relative</Chip>
            )}
            {person.lifeStatus === "living" && <Chip tone="teal">Living</Chip>}
            {person.lifeStatus === "deceased" && <Chip tone="stone">Deceased</Chip>}
            {!person.lifeStatus && <Chip tone="stone">Status unknown</Chip>}
            {isYou && <Chip tone="teal">This is you</Chip>}
            {claimed && !isYou && <Chip tone="teal">Has an account</Chip>}
            {!claimed && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void run(() => claimPerson(person.id), {
                    success: "This node is now you",
                  })
                }
                className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 transition hover:bg-teal-800 hover:text-white disabled:opacity-50"
              >
                This is me
              </button>
            )}
          </div>

          {person.notes && (
            <p className="mt-4 rounded-xl bg-stone-50 px-3.5 py-3 text-sm leading-relaxed text-stone-600">
              {person.notes}
            </p>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-xs text-stone-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Added by {userName(state, person.addedById)} · {timeAgo(person.createdAt)}
          </p>
          <EditHistory entityId={person.id} />

          {/* Isolate — give this person's immediate family the whole canvas */}
          <button
            onClick={() => onToggleIsolate(person.id)}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              isolatedId === person.id
                ? "border-teal-700 bg-teal-800 text-white shadow-sm"
                : "border-stone-200 bg-white text-stone-700 hover:border-teal-700/40 hover:bg-teal-800/5"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3" />
            </svg>
            {isolatedId === person.id ? "Show whole tree" : "Isolate this family"}
          </button>

          {/* Kinship calculator against anyone else in the family */}
          <button
            onClick={() => onCompare(person.id)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-teal-700/40 hover:bg-teal-800/5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6.5" cy="12" r="3" />
              <circle cx="17.5" cy="12" r="3" />
              <path d="M9.5 12h5" />
            </svg>
            How are they related to…
          </button>

          {/* "Me" — trace how you're related */}
          {mePersonId && person.id !== mePersonId && (
            <div className="mt-4">
              <button
                onClick={onToggleMeMode}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  meModeOn
                    ? "border-teal-700 bg-teal-800 text-white shadow-sm"
                    : "border-stone-200 bg-white text-stone-700 hover:border-teal-700/40 hover:bg-teal-800/5"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="19" r="2.4" />
                  <circle cx="19" cy="5" r="2.4" />
                  <path d="M7 17.2c3-2.6 7-6.6 10-10.4" strokeDasharray="1 3.2" />
                </svg>
                {meModeOn ? "Hide my connection" : "How are we connected?"}
              </button>
              {meModeOn && !pathFound && (
                <p className="mt-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  No recorded chain of relationships links you two yet — add the
                  missing branches and try again.
                </p>
              )}
            </div>
          )}

          {/* Assumed connections awaiting confirm/deny */}
          {suggestions.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-800">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" />
                </svg>
                Assumed · {suggestions.length}
              </p>
              <ul className="space-y-1.5">
                {suggestions.map((s) => {
                  const from = state.people.find((p) => p.id === s.fromPersonId);
                  const to = state.people.find((p) => p.id === s.toPersonId);
                  const via = state.people.find((p) => p.id === s.viaPersonId);
                  if (!from || !to || !via) return null;
                  const first = (n: string) => n.split(" ")[0];
                  return (
                    <li
                      key={s.key}
                      className="rounded-xl border border-teal-700/25 bg-teal-800/5 px-3 py-2.5"
                    >
                      <p className="text-sm leading-snug text-stone-700">
                        {s.type === "PARENT_OF" ? (
                          <>
                            Is <span className="font-semibold">{from.name}</span> also a
                            parent of{" "}
                            <span className="font-semibold">{first(to.name)}</span>?
                          </>
                        ) : s.type === "SIBLING_OF" ? (
                          <>
                            Are <span className="font-semibold">{first(from.name)}</span>{" "}
                            and <span className="font-semibold">{first(to.name)}</span>{" "}
                            siblings?
                          </>
                        ) : (
                          <>
                            Are <span className="font-semibold">{first(from.name)}</span>{" "}
                            and <span className="font-semibold">{first(to.name)}</span> a
                            couple?
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                        {s.reasonKind === "siblingsParent" &&
                          `Assumed because ${first(via.name)} is their sibling.`}
                        {s.reasonKind === "sharedParent" &&
                          `They're both children of ${via.name}.`}
                        {s.reasonKind === "sharedSibling" &&
                          `They're both siblings of ${first(via.name)}.`}
                        {s.reasonKind === "sharedChild" &&
                          `They're both parents of ${first(via.name)}.`}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          disabled={pending}
                          onClick={() =>
                            void run(
                              () =>
                                addRelationship(
                                  person.familyId,
                                  s.fromPersonId,
                                  s.toPersonId,
                                  s.type
                                ),
                              {
                                success:
                                  s.type === "PARENT_OF"
                                    ? `${from.name} added as a parent`
                                    : s.type === "SIBLING_OF"
                                      ? "Siblings connected"
                                      : "Partners connected",
                                failure: "Couldn't add that",
                              }
                            )
                          }
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Confirm
                        </button>
                        <button
                          disabled={pending}
                          onClick={() =>
                            void run(() => dismissSuggestion(person.familyId, s.key), {
                              failure: "Couldn't dismiss that",
                            })
                          }
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 active:scale-[0.98] disabled:opacity-50"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                          Deny
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Additional info */}
          <PersonExtras person={person} onSelectPerson={onSelectPerson} />

          {/* Connections */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              Connections · {rels.length}
            </p>
            {rels.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-200 px-3.5 py-3 text-sm text-stone-400">
                Not connected to anyone yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {rels.map((r) => {
                  const { label, other } = relSentence(r);
                  const confirms = state.confirmations.filter(
                    (c) => c.relationshipId === r.id && c.type === "CONFIRM"
                  ).length;
                  const disputes = state.confirmations.filter(
                    (c) => c.relationshipId === r.id && c.type === "DISPUTE"
                  ).length;
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => onSelectRelationship(r.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2 text-left transition hover:border-stone-200 hover:bg-stone-50"
                      >
                        <span className="min-w-0 truncate text-sm text-stone-700">
                          <span className="text-stone-400">{label}</span>{" "}
                          <span className="font-medium">{other?.name ?? "?"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold">
                          {confirms > 0 && <span className="text-teal-700">+{confirms}</span>}
                          {disputes > 0 && <span className="text-red-600">−{disputes}</span>}
                          {disputes > 0 && (
                            <span className="ml-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
                              disputed
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <PrimaryButton onClick={() => onAddRelative(person.id)} className="!px-3 !py-2 text-xs">
              + Add relative
            </PrimaryButton>
            <GhostButton onClick={() => onAddChildren(person.id)} className="!px-3 !py-2 text-xs">
              + Add children
            </GhostButton>
            <GhostButton onClick={() => onConnectFrom(person.id)} className="!px-3 !py-2 text-xs">
              Connect to someone
            </GhostButton>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={startEdit}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
            >
              Edit details
            </button>
            <DangerButton
              label="Remove"
              confirmLabel={`Really remove${rels.length ? ` (+${rels.length} connection${rels.length > 1 ? "s" : ""})` : ""}?`}
              onConfirm={() =>
                void run(() => deletePerson(person.id), {
                  failure: `Couldn't remove ${person.name}`,
                }).then((removed) => {
                  if (!removed) return;
                  toast(`${person.name} removed from the tree`, "info");
                  onClose();
                })
              }
            />
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit();
          }}
          className="space-y-4"
        >
          <Field label="Full name">
            <input
              className={inputCls}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Birth year">
              <input
                className={inputCls}
                placeholder="1994"
                value={draft.birthYear}
                onChange={(e) => setDraft((d) => ({ ...d, birthYear: e.target.value }))}
              />
            </Field>
            <Field label="Death year">
              <input
                className={inputCls}
                value={draft.deathYear}
                onChange={(e) => setDraft((d) => ({ ...d, deathYear: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Exact birth date" hint="optional">
              <input
                type="date"
                className={inputCls}
                value={draft.birthDate}
                onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
              />
            </Field>
            <Field label="Exact death date" hint="optional">
              <input
                type="date"
                className={inputCls}
                value={draft.deathDate}
                onChange={(e) => setDraft((d) => ({ ...d, deathDate: e.target.value }))}
              />
            </Field>
          </div>
          <p className="-mt-1 text-[11px] leading-relaxed text-stone-400">
            An exact date fills in the year for you, so the two can never
            disagree.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                className={inputCls}
                value={draft.lifeStatus}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, lifeStatus: e.target.value as LifeStatus | "" }))
                }
              >
                <option value="">Unknown</option>
                <option value="living">Living</option>
                <option value="deceased">Deceased</option>
              </select>
            </Field>
            <Field label="Gender" hint="for wording">
              <select
                className={inputCls}
                value={draft.gender}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, gender: e.target.value as Gender | "" }))
                }
              >
                <option value="">Not recorded</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <p className="-mt-1 text-[11px] leading-relaxed text-stone-400">
            Gender is only used to choose words like &ldquo;mother&rdquo; or
            &ldquo;niece&rdquo;. Leave it unset and the tree says
            &ldquo;parent&rdquo; instead.
          </p>
          <Field label="Notes">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </GhostButton>
            <PrimaryButton type="submit" disabled={!draft.name.trim() || pending}>
              {pending ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}

/* ─── Relationship ──────────────────────────────────────────────────── */

function RelationshipDetail({
  relationship,
  onSelectPerson,
  onClose,
}: {
  relationship: Relationship;
  onSelectPerson: (id: string) => void;
  onClose: () => void;
}) {
  const { state, currentUser, setReaction, deleteRelationship, updateRelationship } = useStore();
  const [editingRel, setEditingRel] = useState(false);
  const toast = useToast();
  const { run, pending } = useAction();

  const from = state.people.find((p) => p.id === relationship.fromPersonId);
  const to = state.people.find((p) => p.id === relationship.toPersonId);
  const reactions = state.confirmations.filter(
    (c) => c.relationshipId === relationship.id
  );
  const confirms = reactions.filter((r) => r.type === "CONFIRM");
  const disputes = reactions.filter((r) => r.type === "DISPUTE");
  const mine = reactions.find((r) => r.userId === currentUser?.id);
  const disputed = disputes.length > 0;

  const verb =
    relationship.type === "PARENT_OF"
      ? "is the parent of"
      : relationship.type === "SPOUSE_OF"
        ? "is the spouse of"
        : "is a sibling of";

  const kind = relationship.kind ?? defaultKind(relationship.type);
  const kindLabel = kindsFor(relationship.type).find((k) => k.value === kind)?.label;
  const kindIsDefault = kind === defaultKind(relationship.type);

  return (
    <div className="px-5 py-4">
      <p className="font-display text-lg leading-snug text-stone-900">
        <PersonLink name={from?.name} onClick={() => from && onSelectPerson(from.id)} />{" "}
        <span className="text-stone-400">{verb}</span>{" "}
        <PersonLink name={to?.name} onClick={() => to && onSelectPerson(to.id)} />
      </p>

      {!kindIsDefault && (
        <p className="mt-2">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
            {kindLabel}
          </span>
        </p>
      )}

      {disputed && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-700">
          <svg className="mt-0.5 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" />
          </svg>
          This connection is disputed. It stays on the tree, flagged, until the
          family agrees — nothing gets quietly deleted.
        </p>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-stone-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Asserted by {userName(state, relationship.addedById)} · {timeAgo(relationship.createdAt)}
      </p>

      {/* Your take */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Your take
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={pending}
            onClick={() =>
              void run(() => setReaction(relationship.id, "CONFIRM"), {
                failure: "Couldn't record that",
              })
            }
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              mine?.type === "CONFIRM"
                ? "border-teal-700 bg-teal-800 text-white shadow-sm"
                : "border-stone-200 bg-white text-teal-800 hover:border-teal-700/40 hover:bg-teal-800/5"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Confirm
          </button>
          <button
            disabled={pending}
            onClick={() =>
              void run(() => setReaction(relationship.id, "DISPUTE"), {
                failure: "Couldn't record that",
              })
            }
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              mine?.type === "DISPUTE"
                ? "border-red-500 bg-red-600 text-white shadow-sm"
                : "border-stone-200 bg-white text-red-600 hover:border-red-400/50 hover:bg-red-50"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Dispute
          </button>
        </div>
        {mine && (
          <p className="mt-1.5 text-center text-[11px] text-stone-400">
            Tap again to withdraw your {mine.type === "CONFIRM" ? "confirmation" : "dispute"}.
          </p>
        )}
      </div>

      {/* Tally */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Family consensus · +{confirms.length}/−{disputes.length}
        </p>
        {reactions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 px-3.5 py-3 text-sm text-stone-400">
            No one has weighed in yet. Be the first.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {[...reactions]
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-stone-700">
                    <Avatar name={userName(state, c.userId)} id={c.userId} size={22} />
                    {userName(state, c.userId)}
                    {c.userId === currentUser?.id && (
                      <span className="text-[10px] font-semibold uppercase text-stone-400">you</span>
                    )}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      c.type === "CONFIRM" ? "text-teal-700" : "text-red-600"
                    }`}
                  >
                    {c.type === "CONFIRM" ? "confirmed" : "disputed"} · {timeAgo(c.createdAt)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {editingRel ? (
        <RelationshipEditor
          relationship={relationship}
          reactionCount={reactions.length}
          onCancel={() => setEditingRel(false)}
          saving={pending}
          onSave={(patch) =>
            void run(() => updateRelationship(relationship.id, patch), {
              success: "Connection updated",
            }).then((saved) => {
              if (saved) setEditingRel(false);
            })
          }
        />
      ) : (
        <button
          onClick={() => setEditingRel(true)}
          className="mt-5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-teal-700/40 hover:bg-teal-800/5"
        >
          Edit this connection
        </button>
      )}

      <EditHistory entityId={relationship.id} />

      <div className="mt-5 flex justify-end border-t border-stone-100 pt-3">
        <DangerButton
          label="Remove connection"
          confirmLabel="Really remove it?"
          onConfirm={() =>
            void run(() => deleteRelationship(relationship.id), {
              failure: "Couldn't remove that connection",
            }).then((removed) => {
              if (!removed) return;
              toast("Connection removed", "info");
              onClose();
            })
          }
        />
      </div>
    </div>
  );
}

/**
 * A portrait, uploaded or picked from the photos already attached to them.
 * Only ever shown when one exists — an empty circle of initials next to
 * every name was just noise.
 */
function ProfilePicture({
  person,
  onSet,
}: {
  person: Person;
  onSet: (personId: string, dataUrl: string | null) => Promise<void>;
}) {
  const { state } = useStore();
  const toast = useToast();
  const { run, pending } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);

  const theirPhotos = state.photos.filter(
    (ph) => ph.personId === person.id || ph.taggedPersonIds.includes(person.id)
  );

  const choose = async (file: File | undefined) => {
    if (!file) return;
    let dataUrl: string;
    try {
      // portraits render at 56px, so a small square is plenty
      dataUrl = await fileToDataUrl(file, 320);
    } catch {
      toast("Couldn't read that image", "error");
      return;
    }
    // The upload is the part that can fail slowly, so the confirmation waits
    // for it rather than for the file being read off disk.
    await run(() => onSet(person.id, dataUrl), {
      success: "Profile picture updated",
      failure: "Couldn't save that picture",
    });
  };

  return (
    <div className="relative">
      <button
        disabled={pending}
        onClick={() => (theirPhotos.length ? setPicking((p) => !p) : fileRef.current?.click())}
        className="group relative block rounded-full disabled:opacity-60"
        title={person.photoUrl ? "Change profile picture" : "Add a profile picture"}
        aria-label={person.photoUrl ? "Change profile picture" : "Add a profile picture"}
      >
        <Avatar name={person.name} id={person.name} size={48} src={person.photoUrl} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-800 text-white shadow ring-2 ring-white transition group-hover:bg-teal-700">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0])}
      />

      {picking && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setPicking(false)} />
          <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
            <button
              onClick={() => {
                setPicking(false);
                fileRef.current?.click();
              }}
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-stone-700 transition hover:bg-stone-50"
            >
              Upload a picture…
            </button>
            {theirPhotos.length > 0 && (
              <>
                <p className="mt-1.5 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  Or use one of their photos
                </p>
                <div className="grid grid-cols-4 gap-1 px-1">
                  {theirPhotos.map((ph) => (
                    <button
                      key={ph.id}
                      onClick={() => {
                        setPicking(false);
                        void run(() => onSet(person.id, ph.dataUrl), {
                          success: "Profile picture updated",
                          failure: "Couldn't save that picture",
                        });
                      }}
                      className="aspect-square overflow-hidden rounded-md ring-1 ring-stone-200 transition hover:ring-teal-700"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.dataUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {person.photoUrl && (
              <button
                onClick={() => {
                  setPicking(false);
                  void run(() => onSet(person.id, null), {
                    failure: "Couldn't remove that picture",
                  }).then((removed) => {
                    if (removed) toast("Profile picture removed", "info");
                  });
                }}
                className="mt-1.5 w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-red-600 transition hover:bg-red-50"
              >
                Remove picture
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Fixing a mis-entered link used to mean deleting and re-adding it, which
 * threw away everyone's confirmations. Editing in place keeps them — except
 * where the claim itself changes, since nobody endorsed the new one.
 */
function RelationshipEditor({
  relationship,
  reactionCount,
  saving,
  onSave,
  onCancel,
}: {
  relationship: Relationship;
  reactionCount: number;
  saving: boolean;
  onSave: (patch: {
    type?: RelationType;
    kind?: RelationKind;
    swap?: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<RelationType>(relationship.type);
  const [kind, setKind] = useState<RelationKind>(
    relationship.kind ?? defaultKind(relationship.type)
  );
  const [swap, setSwap] = useState(false);

  const claimChanged = type !== relationship.type || swap;

  return (
    <div className="mt-5 rounded-xl border border-teal-700/30 bg-teal-800/5 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-teal-800">
        Edit connection
      </p>

      <label className="mb-2 block">
        <span className="mb-1 block text-xs font-medium text-stone-600">
          Relationship
        </span>
        <select
          className={inputCls}
          value={type}
          onChange={(e) => {
            const t = e.target.value as RelationType;
            setType(t);
            setKind(defaultKind(t));
          }}
        >
          <option value="PARENT_OF">is the parent of</option>
          <option value="SPOUSE_OF">is the spouse of</option>
          <option value="SIBLING_OF">is a sibling of</option>
        </select>
      </label>

      <label className="mb-2 block">
        <span className="mb-1 block text-xs font-medium text-stone-600">Kind</span>
        <select
          className={inputCls}
          value={kind}
          onChange={(e) => setKind(e.target.value as RelationKind)}
        >
          {kindsFor(type).map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      {type === "PARENT_OF" && (
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={swap}
            onChange={(e) => setSwap(e.target.checked)}
            className="h-3.5 w-3.5 accent-teal-800"
          />
          Swap who is the parent
        </label>
      )}

      {claimChanged && reactionCount > 0 && (
        <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
          This changes what the connection claims, so its {reactionCount}{" "}
          {reactionCount === 1 ? "reaction" : "reactions"} will be cleared —
          they endorsed something different.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onCancel} className="!px-3 !py-1.5 text-xs">
          Cancel
        </GhostButton>
        <PrimaryButton
          type="button"
          className="!px-3 !py-1.5 text-xs"
          disabled={saving}
          onClick={() => onSave({ type, kind, swap })}
        >
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </div>
  );
}

/**
 * Provenance recorded who *added* someone but nothing about later edits, so
 * a name could be quietly rewritten with no trace. This closes that hole.
 */
function EditHistory({ entityId }: { entityId: string }) {
  const { state, editsFor } = useStore();
  const [open, setOpen] = useState(false);
  const edits = editsFor(entityId);
  if (edits.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-stone-400 transition hover:text-stone-600"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={open ? "rotate-90 transition" : "transition"}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {edits.length} {edits.length === 1 ? "edit" : "edits"} since
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 border-l-2 border-stone-100 pl-2.5">
          {edits.map((e) => (
            <li key={e.id} className="text-[11px] leading-snug text-stone-500">
              <span className="font-medium text-stone-600">{editFieldLabel(e.field)}</span>{" "}
              {e.from ? (
                <>
                  <span className="line-through opacity-60">{e.from}</span> →{" "}
                </>
              ) : (
                "set to "
              )}
              <span className="text-stone-700">{e.to || "(cleared)"}</span>
              <span className="block text-stone-400">
                {userName(state, e.userId)} · {timeAgo(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonLink({ name, onClick }: { name?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-semibold text-stone-900 underline decoration-stone-300 decoration-2 underline-offset-2 transition hover:text-teal-800 hover:decoration-teal-700/50"
    >
      {name ?? "Unknown"}
    </button>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "teal" | "stone" | "amber";
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        tone === "teal"
          ? "bg-teal-800/10 text-teal-800"
          : tone === "amber"
            ? "bg-amber-600/10 text-amber-700"
            : "bg-stone-100 text-stone-500"
      }`}
    >
      {children}
    </span>
  );
}
