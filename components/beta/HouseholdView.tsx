"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";
import { lifespan } from "@/lib/helpers";
import {
  doorsAcross,
  doorsDown,
  doorsUp,
  type Doorway,
  type Household,
  type Households,
} from "@/lib/beta/household";

/**
 * One household, drawn the way a family group sheet has been drawn for a
 * hundred years: the couple across the top, a single line down to a bar, and
 * the children hanging off it.
 *
 * It is worth being plain about why this shape and not a prettier one. Every
 * child hangs off the same bar, so eight of them cost eight short stubs and
 * no crossings at all — where a line per parent per child costs sixteen lines
 * that cross each other. The drawing stays as calm at eight children as at
 * two, which is the whole requirement.
 */

const CELL_MAX = 132;
const CELL_MIN = 86;
const BUBBLE = 62;

export function HouseholdView({
  house,
  houses,
  people,
  mePersonId,
  relationOf,
  selectedId,
  onSelect,
  onOpen,
}: {
  house: Household;
  houses: Households;
  people: Person[];
  mePersonId: string | null;
  relationOf: (personId: string) => string | undefined;
  selectedId: string | null;
  onSelect: (personId: string) => void;
  onOpen: (householdId: string, throughId: string) => void;
}) {
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const up = useMemo(() => doorsUp(house, houses), [house, houses]);
  const down = useMemo(() => doorsDown(house, houses), [house, houses]);
  const across = useMemo(() => doorsAcross(house, houses), [house, houses]);

  /** every child who keeps a house of their own, and which one */
  const downBy = useMemo(() => {
    const m = new Map<string, Doorway[]>();
    for (const door of down) {
      const list = m.get(door.throughId);
      if (list) list.push(door);
      else m.set(door.throughId, [door]);
    }
    return m;
  }, [down]);

  const heads = house.headIds.map((id) => byId.get(id)).filter(Boolean) as Person[];
  const kids = house.childIds.map((id) => byId.get(id)).filter(Boolean) as Person[];

  /**
   * Eight children at full width is wider than most screens, and a row you
   * have to scroll hides the very thing the household was meant to show. The
   * children close ranks instead, down to the point where a name stops
   * fitting — past that it scrolls, because unreadable is worse than hidden.
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    // Measure the scrolling parent, not this element. This one is inside an
    // overflow container, so it stretches to whatever the children row needs
    // — measuring it would mean asking the row how wide the row is allowed to
    // be, and it would answer "as wide as I already am" every time.
    const frame = el?.parentElement;
    if (!frame) return;
    const read = () => setRoom(frame.clientWidth - 32);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);
  const cell = kids.length
    ? Math.max(CELL_MIN, Math.min(CELL_MAX, room ? room / kids.length : CELL_MAX))
    : CELL_MAX;

  const nameOf = (id: string) => byId.get(id)?.name.split(" ")[0] ?? "Unknown";
  const doorLabel = (door: Doorway) =>
    door.headIds.map(nameOf).join(" & ") || "their family";

  return (
    <div ref={wrapRef} className="flex min-h-full flex-col items-center px-4 py-6">
      {/* ── up: the houses the parents grew up in ── */}
      {up.length > 0 && (
        <div className="mb-1 flex flex-wrap justify-center gap-2">
          {up.map((door) => (
            <DoorChip
              key={`up-${door.throughId}-${door.householdId}`}
              direction="up"
              title={doorLabel(door)}
              detail={`${nameOf(door.throughId)}'s parents · ${door.childCount} ${
                door.childCount === 1 ? "child" : "children"
              }`}
              onClick={() => onOpen(door.householdId, door.throughId)}
            />
          ))}
        </div>
      )}

      {up.length > 0 && <Stem />}

      {/* ── the couple ── */}
      <div className="flex items-start justify-center gap-3 sm:gap-5">
        {heads.map((head, i) => (
          <div key={head.id} className="flex items-start gap-3 sm:gap-5">
            {i > 0 && <MarriageBar />}
            <PersonChip
              person={head}
              relation={relationOf(head.id)}
              isYou={head.id === mePersonId}
              selected={selectedId === head.id}
              width={CELL_MAX}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>

      {/* ── a second marriage is a step sideways ── */}
      {across.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {across.map((door) => (
            <DoorChip
              key={`across-${door.throughId}-${door.householdId}`}
              direction="across"
              title={doorLabel(door)}
              detail={`${nameOf(door.throughId)}'s other marriage`}
              onClick={() => onOpen(door.householdId, door.throughId)}
            />
          ))}
        </div>
      )}

      {/* ── down to the children ── */}
      {kids.length > 0 ? (
        <>
          <Stem />
          <div className="w-full max-w-full overflow-x-auto pb-1">
            <div
              className="relative mx-auto"
              style={{ width: Math.max(cell, kids.length * cell) }}
            >
              {/* one bar, however many children hang off it */}
              {kids.length > 1 && (
                <div
                  className="absolute top-0 h-px bg-stone-300"
                  style={{ left: cell / 2, width: (kids.length - 1) * cell }}
                />
              )}
              <div className="flex">
                {kids.map((kid) => {
                  const theirs = downBy.get(kid.id) ?? [];
                  return (
                    <div
                      key={kid.id}
                      className="flex flex-col items-center"
                      style={{ width: cell }}
                    >
                      <div className="h-5 w-px bg-stone-300" />
                      <PersonChip
                        person={kid}
                        relation={relationOf(kid.id)}
                        isYou={kid.id === mePersonId}
                        selected={selectedId === kid.id}
                        width={cell}
                        onSelect={onSelect}
                      />
                      {theirs.map((door) => (
                        <button
                          key={door.householdId}
                          onClick={() => onOpen(door.householdId, door.throughId)}
                          title={`Open ${doorLabel(door)}`}
                          // never wider than the child it hangs under, or two
                          // neighbouring doors run into one another
                          style={{ maxWidth: cell - 6 }}
                          className="mt-1.5 flex items-center gap-1 rounded-full border border-teal-700/25 bg-teal-800/5 px-2 py-0.5 text-[10px] font-semibold text-teal-800 transition hover:border-teal-700/50 hover:bg-teal-800/10"
                        >
                          <span className="truncate">{doorLabel(door)}</span>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-stone-200 px-4 py-3 text-xs text-stone-400">
          No children recorded in this household yet.
        </p>
      )}
    </div>
  );
}

function Stem() {
  return <div className="h-5 w-px bg-stone-300" />;
}

function MarriageBar() {
  return (
    <div className="mt-[31px] flex items-center" aria-hidden>
      <span className="h-px w-5 bg-amber-500/70 sm:w-8" />
    </div>
  );
}

function PersonChip({
  person,
  relation,
  isYou,
  selected,
  width,
  onSelect,
}: {
  person: Person;
  relation?: string;
  isYou: boolean;
  selected: boolean;
  width: number;
  onSelect: (personId: string) => void;
}) {
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const life = lifespan(person.birthYear, person.deathYear);

  return (
    <div className="flex flex-col items-center" style={{ width: width - 10 }}>
      <button
        onClick={() => onSelect(person.id)}
        aria-label={person.name}
        className={`relative flex items-center justify-center overflow-hidden rounded-full bg-white transition ${
          selected
            ? "ring-[3px] ring-teal-700"
            : isYou
              ? "ring-[3px] ring-teal-600/50"
              : "ring-1 ring-stone-300 hover:ring-teal-700/50"
        }`}
        style={{ width: BUBBLE, height: BUBBLE }}
      >
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-600 to-teal-800 text-base font-semibold text-white">
            {initials}
          </span>
        )}
        {isYou && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-teal-800 px-1 py-px text-[8px] font-bold uppercase text-white">
            you
          </span>
        )}
      </button>
      {/* a fixed block, so a two-line name doesn't push this child's door
          below the next one's and leave the row looking ragged */}
      <div className="mt-1.5 flex h-[66px] w-full flex-col items-center justify-start">
        <p className="line-clamp-2 text-center text-[12.5px] font-semibold leading-tight text-stone-800">
          {person.name}
        </p>
        {relation && (
          <p className="line-clamp-2 text-center text-[9.5px] font-medium uppercase leading-tight tracking-wide text-teal-700/80">
            {relation}
          </p>
        )}
      </div>
      <p className="text-center text-[10px] leading-none text-stone-400">
        {life ?? "—"}
      </p>
    </div>
  );
}

function DoorChip({
  direction,
  title,
  detail,
  onClick,
}: {
  direction: "up" | "across";
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-teal-700/40 hover:bg-teal-800/5"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-teal-700"
      >
        <path d={direction === "up" ? "m6 15 6-6 6 6" : "m9 18 6-6-6-6"} />
      </svg>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-stone-800">
          {title}
        </span>
        <span className="block truncate text-[10px] leading-tight text-stone-400">
          {detail}
        </span>
      </span>
    </button>
  );
}
