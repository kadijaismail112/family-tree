"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { lifespan, personMatch, personMatches, sortedPeople } from "@/lib/helpers";
import type { Person } from "@/lib/types";
import { Avatar, inputCls } from "./ui";

/**
 * One picker for every "which person?" field in the app. A plain `<select>`
 * is unusable once a family passes ~30 names, and the old dropdown was
 * absolutely positioned inside a scrolling modal, so its list was clipped
 * the moment it ran past the modal's edge. This one opens *in flow*: the
 * list pushes the form down instead of hanging over it, which means the
 * modal's own scrollbar is the only scrollbar involved.
 *
 * Everyone in the family is listed — including you. Being the person who
 * claimed a node is not a reason to be missing from the list.
 */
export function PersonPicker({
  label,
  people,
  value,
  onChange,
  onPickFromTree,
  mePersonId,
  disabledIds,
  placeholder = "Search by name, city, college…",
  emptyLabel = "Choose someone",
  noneLabel,
}: {
  label?: string;
  people: Person[];
  value: string | null;
  onChange: (id: string) => void;
  onPickFromTree?: () => void;
  mePersonId?: string | null;
  /** ids that stay visible but can't be picked — e.g. the other slot */
  disabledIds?: string[];
  placeholder?: string;
  emptyLabel?: string;
  /** when set, an explicit "no one" row that clears the choice */
  noneLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = people.find((p) => p.id === value) ?? null;

  const ordered = useMemo(() => sortedPeople(people, mePersonId), [people, mePersonId]);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return ordered;
    return ordered.filter((p) => personMatches(p, q));
  }, [query, ordered]);

  useEffect(() => setCursor(0), [query, open]);

  // keep the highlighted row in view while arrowing through a long family
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  const pick = (p: Person) => {
    if (disabledIds?.includes(p.id)) return;
    onChange(p.id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="min-w-0">
      {(label || onPickFromTree) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && <span className="text-sm font-medium text-stone-700">{label}</span>}
          {onPickFromTree && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPickFromTree();
              }}
              className="hidden items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-800/10 sm:flex"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h6v6H3zM15 15h6v6h-6zM6 9v6h9" />
              </svg>
              Pick from tree
            </button>
          )}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left transition hover:border-stone-300"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar
                name={selected.name}
                id={selected.id}
                size={32}
                src={selected.photoUrl}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-stone-900">
                    {selected.name}
                  </span>
                  {selected.id === mePersonId && <YouTag />}
                </span>
                <span className="block truncate text-xs text-stone-400">
                  {lifespan(selected.birthYear, selected.deathYear) ?? "dates unknown"}
                </span>
              </span>
            </span>
          ) : (
            <span className={`text-sm ${noneLabel ? "text-stone-700" : "text-stone-400"}`}>
              {noneLabel ?? emptyLabel}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-stone-400">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      ) : (
        <div className="overflow-hidden rounded-xl border border-teal-600 ring-2 ring-teal-600/15">
          <input
            autoFocus
            className={`${inputCls} !rounded-none !border-0 !border-b !border-stone-100 !ring-0`}
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const p = matches[cursor];
                if (p) pick(p);
              } else if (e.key === "Escape") {
                // stop the modal from closing too — one Escape, one dismissal
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
          <ul ref={listRef} className="max-h-60 overflow-y-auto bg-white py-1">
            {noneLabel && !query.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-sm text-stone-500 transition hover:bg-stone-50"
                >
                  {noneLabel}
                </button>
              </li>
            )}
            {matches.length === 0 && (
              <li className="px-3.5 py-3 text-sm text-stone-400">
                No one matches “{query.trim()}”.
              </li>
            )}
            {matches.map((p, i) => {
              const hint = query.trim() ? personMatch(p, query) : null;
              const isDisabled = disabledIds?.includes(p.id) ?? false;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    data-idx={i}
                    disabled={isDisabled}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => pick(p)}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      i === cursor && !isDisabled ? "bg-teal-800/5" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-stone-800">{p.name}</span>
                        {p.id === mePersonId && <YouTag />}
                      </span>
                      {hint && (
                        <span className="block truncate text-[11px] text-stone-400">
                          {hint}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-stone-400">
                      {lifespan(p.birthYear, p.deathYear) ?? ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-stone-100 bg-stone-50 px-3 py-1.5">
            <span className="text-[11px] text-stone-400">
              {matches.length} of {people.length}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-200/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function YouTag() {
  return (
    <span className="shrink-0 rounded-full bg-teal-800/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-800">
      you
    </span>
  );
}
