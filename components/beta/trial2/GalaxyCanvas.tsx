"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person, Relationship } from "@/lib/types";
import { buildGalaxy, COL_W, focusBand, ROW_H, type Galaxy } from "@/lib/beta/galaxy";
import { describeRelationship } from "@/lib/relationship";
import {
  haze,
  presence,
  projectAll,
  type Camera,
  type Projected,
} from "./projection";

/**
 * TRIAL 2 · The canvas everybody lives on.
 *
 * The layout is computed once and never changes. Everything you see happening
 * is the camera moving: flying to a person, stepping a generation, swinging a
 * few degrees for parallax. Because nothing is added or removed, the tree you
 * are reading keeps its place relative to the tree you are not.
 */

const EASE = 0.11;

export function GalaxyCanvas({
  people,
  relationships,
  mePersonId,
  anchorId,
  generationCursor,
  selectedId,
  onSelect,
  onAnchor,
  onGalaxy,
}: {
  people: Person[];
  relationships: Relationship[];
  mePersonId: string | null;
  anchorId: string;
  generationCursor: number;
  selectedId: string | null;
  onSelect: (personId: string | null) => void;
  onAnchor: (personId: string) => void;
  onGalaxy: (galaxy: Galaxy) => void;
}) {
  const galaxy = useMemo(
    () => buildGalaxy(people, relationships),
    [people, relationships]
  );
  useEffect(() => onGalaxy(galaxy), [galaxy, onGalaxy]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const band = useMemo(
    () => focusBand(anchorId, generationCursor, galaxy),
    [anchorId, generationCursor, galaxy]
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ w: box.width, h: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Where the camera is being asked to go. The anchor sets x and z, the
   * generation cursor sets the height, and the two move independently — which
   * is what lets you rise through the generations of one family without
   * losing your place in it.
   */
  const target = useMemo<Camera>(() => {
    const node = galaxy.nodes.get(anchorId);
    const anchorX = node?.x ?? 0;
    const anchorZ = node?.z ?? 0;
    const home = node?.islandId;

    /**
     * Frame the bloodline you are standing in, not everyone you are related
     * to. Averaging in the family somebody married into drags the camera out
     * into the gap between two islands, which frames neither — so the people
     * used for framing are the ones on this island, and the family across the
     * way stays where it is, at the edge, with the marriage line running to
     * it.
     */
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let seen = 0;
    for (const id of Array.from(band)) {
      const n = galaxy.nodes.get(id);
      if (!n || n.islandId !== home) continue;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
      seen++;
    }
    if (!seen) {
      minX = maxX = anchorX;
      minY = maxY = generationCursor * ROW_H;
    }

    // pull back far enough to hold the whole family, but never so far that a
    // small one turns into three specks in the middle of an empty canvas
    const spanX = maxX - minX + COL_W * 2.2;
    const spanY = maxY - minY + ROW_H * 1.4;
    const fit = Math.min(size.w / spanX, size.h / spanY);
    const zoom = Math.max(0.4, Math.min(1.05, fit));

    return {
      // hold the anchor near the middle, nudged toward the family's centre
      x: anchorX * 0.55 + ((minX + maxX) / 2) * 0.45,
      y: generationCursor * ROW_H,
      z: anchorZ,
      zoom,
      yaw: 0,
    };
  }, [anchorId, generationCursor, galaxy, band, size.w, size.h]);

  // The camera is animated outside React's state so a flight costs one style
  // write per frame rather than a re-render per frame.
  const camRef = useRef<Camera>(target);
  const [, forceFrame] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const step = () => {
      const cam = camRef.current;
      const dx = target.x - cam.x;
      const dy = target.y - cam.y;
      const dz = target.z - cam.z;
      const dzoom = target.zoom - cam.zoom;
      const settled =
        Math.abs(dx) < 0.4 &&
        Math.abs(dy) < 0.4 &&
        Math.abs(dz) < 0.4 &&
        Math.abs(dzoom) < 0.002;
      if (settled) {
        camRef.current = { ...cam, ...target };
        forceFrame((n) => n + 1);
        rafRef.current = null;
        return;
      }
      camRef.current = {
        ...cam,
        x: cam.x + dx * EASE,
        y: cam.y + dy * EASE,
        z: cam.z + dz * EASE,
        zoom: cam.zoom + dzoom * EASE,
      };
      forceFrame((n) => n + 1);
      rafRef.current = requestAnimationFrame(step);
    };
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target]);

  const cam = camRef.current;
  const shots = useMemo(
    () => projectAll(galaxy, cam, size.w, size.h),
    // camera is a ref, so the frame counter is what actually drives this
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [galaxy, cam.x, cam.y, cam.z, cam.zoom, cam.yaw, size.w, size.h]
  );

  /** what each person is to you — computed once for the band, not for all */
  const relationOf = useMemo(() => {
    const out = new Map<string, string>();
    if (!mePersonId) return out;
    for (const id of Array.from(band)) {
      if (id === mePersonId) continue;
      const r = describeRelationship(id, mePersonId, people, relationships);
      if (r.aTerm) out.set(id, `your ${r.aTerm}`);
    }
    return out;
  }, [band, mePersonId, people, relationships]);

  // furthest first, so nearer faces overlap the ones behind them
  const order = useMemo(
    () => Array.from(shots.values()).sort((a, b) => b.depth - a.depth),
    [shots]
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      {/* ─── the ties between people ─── */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {galaxy.links.map((link) => {
          const a = shots.get(link.a);
          const b = shots.get(link.b);
          if (!a || !b) return null;
          const lit = band.has(link.a) && band.has(link.b);
          const depth = (a.depth + b.depth) / 2;
          const alpha = presence(depth, lit) * (lit ? 0.85 : 0.3);
          if (alpha < 0.04) return null;

          // a marriage between two families arcs across the gap; everything
          // else is a straight run within one
          const mid = { x: (a.sx + b.sx) / 2, y: (a.sy + b.sy) / 2 };
          const lift = link.bridge ? -Math.abs(a.sx - b.sx) * 0.18 - 24 : 0;
          const d = link.bridge
            ? `M ${a.sx} ${a.sy} Q ${mid.x} ${mid.y + lift} ${b.sx} ${b.sy}`
            : `M ${a.sx} ${a.sy} L ${b.sx} ${b.sy}`;

          return (
            <path
              key={`${link.kind}-${link.id}`}
              d={d}
              fill="none"
              stroke={
                link.kind === "spouse"
                  ? "#fbbf24"
                  : link.kind === "sibling"
                    ? "#a5b4fc"
                    : "#5eead4"
              }
              strokeWidth={Math.max(
                0.6,
                (link.bridge ? 2.6 : lit ? 2 : 1.1) * a.scale
              )}
              strokeOpacity={link.bridge ? Math.min(1, alpha * 1.5) : alpha}
              strokeDasharray={link.kind === "sibling" ? "5 5" : undefined}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* ─── the people ─── */}
      {order.map((shot) => (
        <PersonBody
          key={shot.personId}
          shot={shot}
          person={byId.get(shot.personId)}
          inBand={band.has(shot.personId)}
          isYou={shot.personId === mePersonId}
          isAnchor={shot.personId === anchorId}
          selected={selectedId === shot.personId}
          relation={relationOf.get(shot.personId)}
          onSelect={onSelect}
          onAnchor={onAnchor}
        />
      ))}
    </div>
  );
}

function PersonBody({
  shot,
  person,
  inBand,
  isYou,
  isAnchor,
  selected,
  relation,
  onSelect,
  onAnchor,
}: {
  shot: Projected;
  person?: Person;
  inBand: boolean;
  isYou: boolean;
  isAnchor: boolean;
  selected: boolean;
  relation?: string;
  onSelect: (personId: string | null) => void;
  onAnchor: (personId: string) => void;
}) {
  if (!person) return null;
  const opacity = presence(shot.depth, inBand);
  if (opacity < 0.05) return null;

  const blur = haze(shot.depth, inBand);
  const size = Math.max(14, 62 * shot.scale);
  // Far-off faces are never asked to render text they'd only smear; at that
  // distance a person is a light in someone else's family, not a name.
  const readable = shot.scale > 0.42 && opacity > 0.42;
  // the relation line is the first thing to go: at a distance it is the part
  // that turns into a smear over whoever is standing in front
  const showRelation = inBand && blur < 1.2;

  return (
    <div
      className="absolute will-change-transform"
      style={{
        left: shot.sx,
        top: shot.sy,
        transform: "translate(-50%, -50%)",
        opacity,
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
        zIndex: Math.round(1000 - shot.depth / 10),
      }}
    >
      <div className="flex flex-col items-center">
        <button
          onClick={() => onSelect(selected ? null : person.id)}
          onDoubleClick={() => onAnchor(person.id)}
          aria-label={person.name}
          className="relative rounded-full outline-none transition-transform duration-200 hover:scale-110"
          style={{ width: size, height: size }}
        >
          {isAnchor && (
            <span
              aria-hidden
              className="absolute -inset-2 rounded-full bg-teal-300/25 blur-md"
            />
          )}
          <span
            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white ${
              inBand
                ? "from-teal-400/95 to-cyan-700/95"
                : "from-slate-500/80 to-slate-700/80"
            } ${
              selected
                ? "ring-[3px] ring-white"
                : isAnchor
                  ? "ring-[3px] ring-teal-200"
                  : inBand
                    ? "ring-2 ring-teal-200/50"
                    : "ring-1 ring-white/20"
            }`}
            style={{ fontSize: Math.max(8, size * 0.34) }}
          >
            {person.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              person.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]!.toUpperCase())
                .join("")
            )}
          </span>
          {isYou && readable && (
            <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 py-px text-[8px] font-bold uppercase text-teal-900 shadow">
              you
            </span>
          )}
        </button>

        {readable && (
          <div
            className="mt-1.5 flex flex-col items-center"
            style={{ width: Math.max(90, 132 * shot.scale) }}
          >
            <p
              className="line-clamp-2 text-center font-semibold leading-tight text-white"
              style={{
                fontSize: Math.max(9, 12.5 * shot.scale),
                // names cross in a crowd; a dark rim keeps each one readable
                textShadow: "0 1px 3px rgba(3,7,18,0.95), 0 0 8px rgba(3,7,18,0.7)",
              }}
            >
              {person.name}
            </p>
            {relation && showRelation && (
              <p
                className="line-clamp-2 text-center font-medium uppercase leading-tight tracking-wide text-teal-300/85"
                style={{ fontSize: Math.max(7, 9.5 * shot.scale) }}
              >
                {relation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
