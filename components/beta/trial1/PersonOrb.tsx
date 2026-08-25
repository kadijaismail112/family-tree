"use client";

import { memo } from "react";
import { lifespan } from "@/lib/helpers";
import type { WorldRole } from "@/lib/beta/world";

export interface OrbProps {
  personId: string;
  name: string;
  photoUrl?: string;
  birthYear?: string;
  deathYear?: string;
  role: WorldRole;
  /** they have a family of their own, waiting through the door */
  portal: boolean;
  beyond: number;
  /** "your great-aunt" — worked out against your own claimed node */
  relation?: string;
  isYou: boolean;
  selected: boolean;
  dimmed: boolean;
  onSelect: (personId: string) => void;
  onEnter: (personId: string) => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * TRIAL 1 · One person, as a body in space rather than a card in a chart.
 *
 * The ring carries the meaning: solid for blood, warm and dashed for someone
 * who married in, and a lit halo when their own family is through the door.
 */
function PersonOrbInner({
  personId,
  name,
  photoUrl,
  birthYear,
  deathYear,
  role,
  portal,
  beyond,
  relation,
  isYou,
  selected,
  dimmed,
  onSelect,
  onEnter,
}: OrbProps) {
  const life = lifespan(birthYear, deathYear);
  const anchor = role === "anchor";
  const married = role === "spouse";
  const size = anchor ? 112 : 84;

  return (
    <div
      className={`group/orb relative flex w-[132px] shrink-0 flex-col items-center transition-all duration-500 ${
        dimmed ? "opacity-25" : "opacity-100"
      }`}
    >
      <button
        onClick={() => onSelect(personId)}
        aria-label={`${name}${relation ? `, ${relation}` : ""}`}
        className="relative flex flex-col items-center outline-none"
        style={{ width: size, height: size }}
      >
        {/* the halo that says there is more of this person elsewhere */}
        {portal && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 animate-[spin_9s_linear_infinite] rounded-full border-2 border-dashed border-amber-400/70"
          />
        )}
        {anchor && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-full bg-teal-400/20 blur-md"
          />
        )}
        <span
          className={`relative flex items-center justify-center overflow-hidden rounded-full text-white transition-all duration-300 ${
            married
              ? "ring-[3px] ring-amber-400/80"
              : "ring-[3px] ring-teal-300/70"
          } ${
            selected
              ? "scale-105 shadow-[0_0_0_4px_rgba(255,255,255,0.25),0_10px_40px_-6px_rgba(45,212,191,0.65)]"
              : "shadow-[0_8px_30px_-10px_rgba(0,0,0,0.8)] group-hover/orb:scale-105"
          }`}
          style={{ width: size, height: size }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br font-semibold ${
                married
                  ? "from-amber-500/90 to-orange-700/90"
                  : "from-teal-500/90 to-cyan-800/90"
              } ${anchor ? "text-2xl" : "text-lg"}`}
            >
              {initials(name)}
            </span>
          )}
        </span>
        {isYou && (
          <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-900 shadow">
            you
          </span>
        )}
      </button>

      <p
        className={`mt-2.5 line-clamp-2 text-center text-[13px] font-semibold leading-tight ${
          selected ? "text-white" : "text-indigo-50"
        }`}
      >
        {name}
      </p>
      {relation && (
        <p className="mt-0.5 line-clamp-2 text-balance text-center text-[10px] font-medium uppercase leading-tight tracking-wide text-teal-300/80">
          {relation}
        </p>
      )}
      <p className="mt-0.5 text-center text-[10px] text-indigo-300/50">
        {life ?? "dates unknown"}
      </p>

      {/* the door itself */}
      {portal && (
        <button
          onClick={() => onEnter(personId)}
          className="mt-1.5 flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/40 transition hover:bg-amber-400/30 hover:text-amber-100"
        >
          Enter
          <span className="font-mono opacity-70">+{beyond}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export const PersonOrb = memo(PersonOrbInner);
