"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { describeRelationship } from "@/lib/relationship";
import { lifespan, personMatches } from "@/lib/helpers";
import type { Person } from "@/lib/types";
import { GhostButton, inputCls, Modal, PrimaryButton } from "./ui";

export function RelationshipModal({
  open,
  onClose,
  people,
  aId,
  bId,
  onChangeA,
  onChangeB,
  onPickFromTree,
  onShowPath,
  onSelectPerson,
}: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  aId: string | null;
  bId: string | null;
  onChangeA: (id: string) => void;
  onChangeB: (id: string) => void;
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
      wide
    >
      <div className="space-y-3">
        <PersonPicker
          label="Person 1"
          people={people}
          value={aId}
          onChange={onChangeA}
          onPickFromTree={() => onPickFromTree("a")}
        />
        <PersonPicker
          label="Person 2"
          people={people}
          value={bId}
          onChange={onChangeB}
          onPickFromTree={() => onPickFromTree("b")}
        />
      </div>

      {result && (
        <div className="mt-5 rounded-2xl border border-teal-700/25 bg-teal-800/5 px-4 py-4">
          <p className="font-display text-xl font-semibold leading-tight text-teal-900">
            {result.label}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">{result.aToB}</p>
          {result.bToA && (
            <p className="mt-1 text-sm leading-relaxed text-stone-700">{result.bToA}</p>
          )}
          {result.via && (
            <p className="mt-2 text-xs text-stone-500">{result.via}</p>
          )}

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
      )}

      {!result && (
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

/** Type-ahead picker — a plain select is unusable once a family passes ~30. */
function PersonPicker({
  label,
  people,
  value,
  onChange,
  onPickFromTree,
}: {
  label: string;
  people: Person[];
  value: string | null;
  onChange: (id: string) => void;
  onPickFromTree: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = people.find((p) => p.id === value) ?? null;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenList(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return people.slice(0, 40);
    return people.filter((p) => personMatches(p, q)).slice(0, 40);
  }, [query, people]);

  return (
    <div ref={boxRef} className="relative">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        <button
          onClick={onPickFromTree}
          className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-800/10"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h6v6H3zM15 15h6v6h-6zM6 9v6h9" />
          </svg>
          Pick from tree
        </button>
      </span>
      {selected && !openList ? (
        <button
          onClick={() => {
            setOpenList(true);
            setQuery("");
          }}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-left transition hover:border-stone-300"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {selected.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.photoUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            )}
            <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-stone-900">
              {selected.name}
            </span>
            <span className="block text-xs text-stone-400">
              {lifespan(selected.birthYear, selected.deathYear) ?? "dates unknown"}
            </span>
            </span>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-stone-400">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      ) : (
        <input
          autoFocus={openList}
          className={inputCls}
          placeholder="Search by name, city, college…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpenList(true)}
        />
      )}

      {openList && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {matches.length === 0 && (
            <li className="px-3.5 py-2 text-sm text-stone-400">No one matches.</li>
          )}
          {matches.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  onChange(p.id);
                  setOpenList(false);
                  setQuery("");
                }}
                className="flex w-full items-baseline justify-between gap-2 px-3.5 py-1.5 text-left transition hover:bg-stone-50"
              >
                <span className="truncate text-sm text-stone-800">{p.name}</span>
                <span className="shrink-0 text-[11px] text-stone-400">
                  {lifespan(p.birthYear, p.deathYear) ?? ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
