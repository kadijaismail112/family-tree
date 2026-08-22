"use client";

import { memo } from "react";
import { Handle, Position, useStore as useFlowStore, type NodeProps } from "reactflow";
import { NODE_W } from "@/lib/layout";
import { lifespan } from "@/lib/helpers";

export interface PersonNodeData {
  name: string;
  birthYear?: string;
  deathYear?: string;
  addedByName: string;
  claimed: boolean;
  isYou: boolean;
  dimmed: boolean;
  /** reached this family by marriage rather than by blood */
  marriedIn: boolean;
  /** opens the add-relative flow anchored on this person */
  onQuickAdd?: (personId: string) => void;
  personId: string;
  /** shown beside the name only when a portrait exists */
  photoUrl?: string;
  /** touch devices have no hover, so a selected card shows its + outright */
  quickAddVisible?: boolean;
}

/** The one thing colour encodes on the canvas: how someone joined the family. */
export const BLOOD_COLOR = "#0f766e";
export const MARRIED_COLOR = "#c2620c";

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="sl" />
      <Handle type="source" position={Position.Right} id="sr" />
      <Handle type="target" position={Position.Left} id="tl" />
      <Handle type="target" position={Position.Right} id="tr" />
    </>
  );
}

function PersonNodeInner({ data, selected }: NodeProps<PersonNodeData>) {
  const life = lifespan(data.birthYear, data.deathYear);
  const accent = data.marriedIn ? MARRIED_COLOR : BLOOD_COLOR;

  // Quantised so nodes only re-render when the detail level actually changes,
  // not on every zoom tick. Far out, a card's small print is sub-pixel noise —
  // drop it and scale the name up so the tree still reads as names.
  const lod = useFlowStore((s) =>
    s.transform[2] < 0.45 ? 0 : s.transform[2] < 0.7 ? 1 : 2
  );

  if (lod === 0) {
    return (
      <div
        style={{ width: NODE_W, borderLeft: `10px solid ${accent}` }}
        // hairline borders vanish when the canvas is scaled down, so lean on
        // fill and weight instead of stroke at this distance
        className={`flex items-center rounded-2xl px-4 py-5 shadow-md ring-4 transition-all ${
          selected ? "bg-teal-800 ring-teal-700" : "bg-white ring-stone-300"
        } ${data.dimmed ? "opacity-25" : ""}`}
      >
        {data.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        )}
        <p
          className={`min-w-0 truncate text-2xl font-semibold leading-tight ${
            selected ? "text-white" : "text-stone-900"
          }`}
        >
          {data.name.split(" ")[0]}
        </p>
        <Handles />
      </div>
    );
  }

  return (
    <div
      style={{ width: NODE_W, borderLeftColor: accent }}
      className={`group/node relative rounded-2xl border border-l-[5px] bg-white px-3.5 py-2.5 shadow-sm transition-all ${
        selected
          ? "border-teal-700 shadow-lg ring-2 ring-teal-600/25"
          : "border-stone-200 hover:border-stone-300 hover:shadow-md"
      } ${data.dimmed ? "opacity-25" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        {data.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUrl}
            alt=""
            className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-stone-200"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-1.5 text-[13px] font-semibold leading-tight text-stone-900">
            {/* long names wrap rather than losing a surname */}
            <span className="line-clamp-2 break-words">{data.name}</span>
            {data.isYou && (
              <span className="mt-px shrink-0 rounded-full bg-teal-800/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-800">
                you
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-stone-400">
            {life ?? "dates unknown"}
          </p>
        </div>
      </div>

      {/* add a relative without leaving the canvas */}
      {data.onQuickAdd && !data.dimmed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onQuickAdd!(data.personId);
          }}
          title="Add a relative here"
          aria-label="Add a relative here"
          className={`absolute -bottom-2.5 -right-2.5 z-10 hidden h-6 w-6 items-center justify-center rounded-full bg-teal-800 text-white shadow-md transition hover:bg-teal-700 group-hover/node:opacity-100 sm:flex ${
            data.quickAddVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {lod === 2 && (
        <div className="mt-1.5 flex items-center justify-between border-t border-stone-100 pt-1.5">
          <span className="truncate text-[10px] text-stone-400">
            added by {data.addedByName}
          </span>
          {data.claimed && !data.isYou && (
            <span
              title="This person has an account"
              className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600"
            />
          )}
        </div>
      )}

      <Handles />
    </div>
  );
}

export const PersonNode = memo(PersonNodeInner);
