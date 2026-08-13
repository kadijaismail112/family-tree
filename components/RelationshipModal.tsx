"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { describeRelationship } from "@/lib/relationship";
import type { Person } from "@/lib/types";
import { PersonPicker } from "./PersonPicker";
import { GhostButton, Modal, PrimaryButton } from "./ui";

export function RelationshipModal({
  open,
  onClose,
  people,
  aId,
  bId,
  mePersonId,
  onChangeA,
  onChangeB,
  onSwap,
  onPickFromTree,
  onShowPath,
  onSelectPerson,
}: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  aId: string | null;
  bId: string | null;
  mePersonId?: string | null;
  onChangeA: (id: string) => void;
  onChangeB: (id: string) => void;
  onSwap: () => void;
  onPickFromTree: (which: "a" | "b") => void;
  onShowPath: (path: { personIds: string[]; relationshipIds: string[] }) => void;
  onSelectPerson: (id: string) => void;
}) {
  const { state } = useStore();

  const relationships = useMemo(
    () =>
      people.length
        ? state.relationships.filter((r) => r.familyId === people[0].familyId)
        : [],
    [state.relationships, people]
  );

  const result = useMemo(
    () => (aId && bId ? describeRelationship(aId, bId, people, relationships) : null),
    [aId, bId, people, relationships]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How are they related?"
      subtitle="Pick two people and we'll work out the kinship."
      size="xl"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-2">
        <PersonPicker
          label="Person 1"
          people={people}
          value={aId}
          onChange={onChangeA}
          onPickFromTree={() => onPickFromTree("a")}
          mePersonId={mePersonId}
        />
        <button
          type="button"
          onClick={onSwap}
          disabled={!aId || !bId}
          aria-label="Swap the two people"
          title="Swap"
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center self-center justify-self-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-teal-700/40 hover:text-teal-800 disabled:opacity-30 sm:mt-7"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4 4 8l4 4M4 8h13M16 20l4-4-4-4M20 16H7" />
          </svg>
        </button>
        <PersonPicker
          label="Person 2"
          people={people}
          value={bId}
          onChange={onChangeB}
          onPickFromTree={() => onPickFromTree("b")}
          mePersonId={mePersonId}
        />
      </div>

      {result ? (
        <div className="mt-5 rounded-2xl border border-teal-700/25 bg-teal-800/5 px-4 py-4">
          <p className="font-display text-xl font-semibold leading-tight text-teal-900">
            {result.label}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">{result.aToB}</p>
          {result.bToA && (
            <p className="mt-1 text-sm leading-relaxed text-stone-700">{result.bToA}</p>
          )}
          {result.via && <p className="mt-2 text-xs text-stone-500">{result.via}</p>}

          {result.commonAncestorIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {result.commonAncestorIds.map((id) => {
                const p = people.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onSelectPerson(id);
                      onClose();
                    }}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-800/20 transition hover:bg-teal-800/10"
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          {result.path && result.path.relationshipIds.length > 0 && (
            <div className="mt-4 flex justify-end">
              <PrimaryButton
                className="!py-2 text-xs"
                onClick={() => {
                  onShowPath(result.path!);
                  onClose();
                }}
              >
                Trace it on the tree
              </PrimaryButton>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-stone-200 px-3.5 py-6 text-center text-sm text-stone-400">
          Choose both people to see how they&apos;re related.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
    </Modal>
  );
}
