"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Person, Relationship } from "@/lib/types";
import { buildGalaxy } from "@/lib/beta/galaxy";
import { describeRelationship } from "@/lib/relationship";

/**
 * TRIAL 2 · A window onto the tree, ten people at a time.
 *
 * The canvas holds everybody, but the screen never does. Three generations
 * are shown at once — the row you are on, the one above, the one below — and
 * at most ten people across them. Everyone else is off the edge, and the
 * arrows bring them in.
 *
 * Lines are drawn only between two people who are both on screen. A line to
 * someone you cannot see tells you nothing and crosses everything, which is
 * what turned the first attempt at this into a thicket.
 */

/**
 * How the three rows share out the screen. Ten is the cap, not a quota: a
 * phone that showed ten would show them at a size nobody can read, so it
 * takes seven and the arrows do more of the work.
 */
const WIDE_ROWS = [3, 4, 3] as const;
const NARROW_ROWS = [2, 3, 2] as const;

const CELL_W = 168;
const CELL_H = 158;
const BUBBLE = 74;
/** the drawing surface is wider than the rows so lines can leave the edge */
const PAD_COLS = 3;

interface Seat {
  personId: string;
  x: number;
  y: number;
  row: number;
}

export function WindowedTree({
  people,
  relationships,
  mePersonId,
  anchorId,
  selectedId,
  onSelect,
  onAnchor,
}: {
  people: Person[];
  relationships: Relationship[];
  mePersonId: string | null;
  anchorId: string;
  selectedId: string | null;
  onSelect: (personId: string | null) => void;
  onAnchor: (personId: string) => void;
}) {
  const galaxy = useMemo(
    () => buildGalaxy(people, relationships),
    [people, relationships]
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  /**
   * Everyone, sorted into generation rows. The order within a row is the one
   * the layout worked out, so families stay side by side and paging sideways
   * walks along a generation rather than jumping about at random.
   */
  const rows = useMemo(() => {
    const buckets = new Map<number, string[]>();
    for (const node of Array.from(galaxy.nodes.values())) {
      if (!buckets.has(node.generation)) buckets.set(node.generation, []);
      buckets.get(node.generation)!.push(node.personId);
    }
    for (const [generation, list] of Array.from(buckets.entries())) {
      list.sort((a, b) => {
        const na = galaxy.nodes.get(a)!;
        const nb = galaxy.nodes.get(b)!;
        return na.x - nb.x || a.localeCompare(b);
      });

      // Seat couples together. Left in plain left-to-right order a row comes
      // out mother, aunt, father, uncle — and the two marriage lines arc over
      // the people between them and cross in the middle. Side by side, each
      // one is a short hop to the next seat.
      const here = new Set(list);
      const seated = new Set<string>();
      const ordered: string[] = [];
      for (const id of list) {
        if (seated.has(id)) continue;
        seated.add(id);
        ordered.push(id);
        for (const partner of galaxy.graph.spouses.get(id) ?? []) {
          if (!here.has(partner) || seated.has(partner)) continue;
          seated.add(partner);
          ordered.push(partner);
        }
      }
      buckets.set(generation, ordered);
    }
    return buckets;
  }, [galaxy]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const perRow = box.w >= 760 ? WIDE_ROWS : NARROW_ROWS;

  /** the slice of a row that is on screen, clamped to what the row holds */
  const startOf = useCallback(
    (g: number, take: number, current: Record<number, number>) => {
      const row = rows.get(g);
      if (!row?.length) return 0;
      return Math.max(0, Math.min(current[g] ?? 0, Math.max(0, row.length - take)));
    },
    [rows]
  );

  /**
   * Where each of the three rows should start so the person you arrived on is
   * in the middle of theirs, with the rows above and below lined up underneath
   * them rather than showing somebody else's relatives.
   */
  const framing = useCallback(
    (personId: string) => {
      const node = galaxy.nodes.get(personId);
      if (!node) return { gen: 0, offset: {} as Record<number, number> };
      const offset: Record<number, number> = {};
      [node.generation - 1, node.generation, node.generation + 1].forEach((g, i) => {
        const row = rows.get(g);
        if (!row?.length) return;
        const take = perRow[i];
        // aim each row at whoever sits nearest the anchor horizontally
        let nearest = 0;
        let best = Infinity;
        row.forEach((id, index) => {
          const apart = Math.abs((galaxy.nodes.get(id)?.x ?? 0) - node.x);
          if (apart < best) {
            best = apart;
            nearest = index;
          }
        });
        offset[g] = Math.max(
          0,
          Math.min(nearest - Math.floor(take / 2), Math.max(0, row.length - take))
        );
      });
      return { gen: node.generation, offset };
    },
    [galaxy, rows, perRow]
  );

  const [view, setView] = useState(() => framing(anchorId));
  const [framedFor, setFramedFor] = useState(anchorId);
  const [framedAt, setFramedAt] = useState(perRow);

  // Worked out during the render rather than in an effect: an effect paints
  // the rows at the wrong offsets first and then slides them into place, and
  // that flick on arrival was the thing that read as broken.
  if (framedFor !== anchorId || framedAt !== perRow) {
    setFramedFor(anchorId);
    setFramedAt(perRow);
    setView(framing(anchorId));
  }

  const { gen, offset } = view;
  const setGen = useCallback(
    (next: number) => setView((v) => ({ ...v, gen: next })),
    []
  );

  const visibleGens = useMemo(() => [gen - 1, gen, gen + 1], [gen]);

  /** who is on screen, and where each of them sits */
  const seats = useMemo(() => {
    const out: Seat[] = [];
    visibleGens.forEach((g, rowIndex) => {
      const row = rows.get(g);
      if (!row?.length) return;
      const take = perRow[rowIndex];
      const start = startOf(g, take, offset);
      const slice = row.slice(start, start + take);
      const width = (slice.length - 1) * CELL_W;
      slice.forEach((personId, i) => {
        out.push({
          personId,
          x: i * CELL_W - width / 2,
          y: rowIndex * CELL_H,
          row: rowIndex,
        });
      });
    });
    return out;
  }, [rows, visibleGens, offset, startOf, perRow]);

  const seatOf = useMemo(() => {
    const m = new Map<string, Seat>();
    for (const s of seats) m.set(s.personId, s);
    return m;
  }, [seats]);

  /** only the ties whose two ends are both on screen */
  const strands = useMemo(
    () => galaxy.links.filter((l) => seatOf.has(l.a) && seatOf.has(l.b)),
    [galaxy.links, seatOf]
  );

  const relationOf = useMemo(() => {
    const out = new Map<string, string>();
    if (!mePersonId) return out;
    for (const seat of seats) {
      if (seat.personId === mePersonId) continue;
      const r = describeRelationship(seat.personId, mePersonId, people, relationships);
      if (r.aTerm) out.set(seat.personId, `your ${r.aTerm}`);
    }
    return out;
  }, [seats, mePersonId, people, relationships]);

  // an arrow only appears when there is something behind it
  const canUp = gen - 1 >= galaxy.minGeneration;
  const canDown = gen + 1 <= galaxy.maxGeneration;
  const middleRow = rows.get(gen) ?? [];
  const middleStart = startOf(gen, perRow[1], offset);
  const canLeft = middleStart > 0;
  const canRight = middleStart + perRow[1] < middleRow.length;

  const slide = useCallback(
    (by: number) => {
      setView((v) => {
        const next = { ...v.offset };
        [v.gen - 1, v.gen, v.gen + 1].forEach((g, i) => {
          const row = rows.get(g);
          if (!row?.length) return;
          const limit = Math.max(0, row.length - perRow[i]);
          next[g] = Math.max(0, Math.min((v.offset[g] ?? 0) + by, limit));
        });
        return { ...v, offset: next };
      });
    },
    [rows, perRow]
  );

  const step = useCallback(
    (by: number) => {
      const want = gen + by;
      if (want < galaxy.minGeneration || want > galaxy.maxGeneration) return;
      setGen(want);
    },
    [gen, galaxy, setGen]
  );

  const stageW = CELL_W * perRow[1];
  const stageH = CELL_H * 3;
  const originX = CELL_W * PAD_COLS + stageW / 2;

  // a last safeguard for the in-between widths, where seven still just
  // misses fitting at full size
  const fit = Math.max(
    0.62,
    Math.min(1, (box.w - 116) / stageW, (box.h - 40) / stageH)
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative"
          style={{
            width: stageW,
            height: stageH,
            transform: `scale(${fit})`,
            transformOrigin: "center center",
          }}
        >
          {/* ── the few lines worth drawing ── */}
          <svg
            className="pointer-events-none absolute"
            style={{
              left: -CELL_W * PAD_COLS,
              top: 0,
              width: CELL_W * (perRow[1] + PAD_COLS * 2),
              height: stageH,
              overflow: "visible",
            }}
            aria-hidden
          >
            {strands.map((link) => {
              const a = seatOf.get(link.a)!;
              const b = seatOf.get(link.b)!;
              const ax = a.x + originX;
              const ay = a.y + BUBBLE / 2;
              const bx = b.x + originX;
              const by = b.y + BUBBLE / 2;

              /**
               * Two people in the same row with somebody sitting between them
               * would be joined by a line straight through that person, which
               * reads as two ties rather than one — a husband and wife either
               * side of her brother looked married to him. Arc over the top
               * instead, in the clear space above the bubbles.
               */
              const sameRow = a.row === b.row;
              const gap = Math.abs(bx - ax);
              const arcs = sameRow && gap > CELL_W * 1.2;
              const lift = arcs ? Math.min(46, 22 + gap * 0.06) : 0;
              const d = arcs
                ? `M ${ax} ${ay} Q ${(ax + bx) / 2} ${ay - lift} ${bx} ${by}`
                : `M ${ax} ${ay} L ${bx} ${by}`;

              return (
                <path
                  key={`${link.kind}-${link.id}`}
                  d={d}
                  fill="none"
                  stroke={link.kind === "spouse" ? "#fbbf24" : "#5eead4"}
                  strokeWidth={link.kind === "spouse" ? 2 : 1.25}
                  strokeOpacity={link.kind === "spouse" ? 0.75 : 0.35}
                  strokeDasharray={link.kind === "sibling" ? "4 5" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {seats.map((seat) => {
            const person = byId.get(seat.personId);
            if (!person) return null;
            return (
              <Bubble
                key={seat.personId}
                seat={seat}
                person={person}
                isYou={seat.personId === mePersonId}
                isAnchor={seat.personId === anchorId}
                selected={selectedId === seat.personId}
                relation={relationOf.get(seat.personId)}
                onSelect={onSelect}
                onAnchor={onAnchor}
              />
            );
          })}
        </div>
      </div>

      {/* ── the arrows that bring the rest in ── */}
      <Arrow dir="up" show={canUp} onClick={() => step(-1)} />
      <Arrow dir="down" show={canDown} onClick={() => step(1)} />
      <Arrow dir="left" show={canLeft} onClick={() => slide(-1)} />
      <Arrow dir="right" show={canRight} onClick={() => slide(1)} />
    </div>
  );
}

function Bubble({
  seat,
  person,
  isYou,
  isAnchor,
  selected,
  relation,
  onSelect,
  onAnchor,
}: {
  seat: Seat;
  person: Person;
  isYou: boolean;
  isAnchor: boolean;
  selected: boolean;
  relation?: string;
  onSelect: (personId: string | null) => void;
  onAnchor: (personId: string) => void;
}) {
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div
      /**
       * No sliding. The lines are redrawn the instant the view changes while
       * a CSS transition takes a third of a second to walk the bubbles over,
       * so for that third of a second every line pointed at empty space. A
       * page that turns cleanly beats one that smears.
       */
      className="absolute flex flex-col items-center"
      style={{
        left: `calc(50% + ${seat.x}px)`,
        top: seat.y,
        width: CELL_W - 18,
        transform: "translateX(-50%)",
      }}
    >
      <button
        onClick={() => onSelect(selected ? null : person.id)}
        onDoubleClick={() => onAnchor(person.id)}
        aria-label={person.name}
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white transition ${
          selected
            ? "ring-[3px] ring-white"
            : isAnchor
              ? "ring-[3px] ring-teal-300"
              : "ring-2 ring-white/25 hover:ring-white/60"
        }`}
        style={{ width: BUBBLE, height: BUBBLE }}
      >
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-800 text-lg font-semibold">
            {initials}
          </span>
        )}
        {isYou && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1 py-px text-[8px] font-bold uppercase text-teal-900">
            you
          </span>
        )}
      </button>
      <p className="mt-1.5 line-clamp-2 text-center text-[12px] font-semibold leading-tight text-white">
        {person.name}
      </p>
      {relation && (
        <p className="line-clamp-2 text-center text-[9px] font-medium uppercase leading-tight tracking-wide text-teal-300/80">
          {relation}
        </p>
      )}
    </div>
  );
}

const ARROW_POS = {
  up: "left-1/2 top-3 -translate-x-1/2",
  down: "left-1/2 bottom-3 -translate-x-1/2",
  left: "left-3 top-1/2 -translate-y-1/2",
  right: "right-3 top-1/2 -translate-y-1/2",
} as const;

const ARROW_PATH = {
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
} as const;

const ARROW_LABEL = {
  up: "Show the generation above",
  down: "Show the generation below",
  left: "Show the people to the left",
  right: "Show the people to the right",
} as const;

function Arrow({
  dir,
  show,
  onClick,
}: {
  dir: keyof typeof ARROW_POS;
  show: boolean;
  onClick: () => void;
}) {
  if (!show) return null;
  return (
    <button
      onClick={onClick}
      aria-label={ARROW_LABEL[dir]}
      title={ARROW_LABEL[dir]}
      className={`absolute z-20 rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-white/20 backdrop-blur-sm transition hover:bg-white/15 hover:text-white ${ARROW_POS[dir]}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={ARROW_PATH[dir]} />
      </svg>
    </button>
  );
}
