"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from "reactflow";
import type { RelationKind, RelationType } from "@/lib/types";
import { carriesLineage } from "@/lib/types";

export interface RelationshipEdgeData {
  type: RelationType;
  confirms: number;
  disputes: number;
  highlighted?: boolean; // on the "Me" path
  dimmed?: boolean; // off the "Me" path
  assumed?: boolean; // inferred (e.g. sibling's parent) — awaiting confirm/deny
  /**
   * Which horizontal lane this family's sibling bar uses. Children of
   * different parents get different lanes so their bars never merge into
   * one rail that makes unrelated branches look joined.
   */
  lane?: number;
  /**
   * Set when both parents are a recorded couple: the descent line starts
   * from the middle of the marriage bar between them rather than from one
   * parent's card, which is how family trees are conventionally drawn.
   */
  origin?: { x: number; y: number; cardBottomY: number };
  /** biological/married by default; step, foster and former draw lighter */
  kind?: RelationKind;
}

const STYLE: Record<RelationType, { stroke: string; dash?: string }> = {
  PARENT_OF: { stroke: "#78716c" },
  SPOUSE_OF: { stroke: "#e11d48" },
  SIBLING_OF: { stroke: "#a8a29e", dash: "6 5" },
};

function RelationshipEdgeInner({
  sourceX: rawSourceX,
  sourceY: rawSourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationshipEdgeData>) {
  const type = data?.type ?? "PARENT_OF";
  const disputed = (data?.disputes ?? 0) > 0;

  // a couple's children descend from the marriage bar, not from one parent
  const sourceX = data?.origin ? data.origin.x : rawSourceX;
  const sourceY = data?.origin ? data.origin.y : rawSourceY;

  let path: string;
  let labelX: number;
  let labelY: number;
  if (type === "PARENT_OF" && data?.lane !== undefined && targetY > sourceY) {
    // parent (or marriage bar) → own sibling bar → child
    const barY =
      (data.origin ? data.origin.cardBottomY : sourceY) + 34 + data.lane * 18;
    const dx = targetX - sourceX;
    if (Math.abs(dx) < 2) {
      path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const dir = dx > 0 ? 1 : -1;
      const r = Math.min(12, Math.abs(dx) / 2, (barY - sourceY) / 2, (targetY - barY) / 2);
      path =
        `M ${sourceX} ${sourceY} L ${sourceX} ${barY - r}` +
        ` Q ${sourceX} ${barY} ${sourceX + dir * r} ${barY}` +
        ` L ${targetX - dir * r} ${barY}` +
        ` Q ${targetX} ${barY} ${targetX} ${barY + r}` +
        ` L ${targetX} ${targetY}`;
    }
    labelX = (sourceX + targetX) / 2;
    labelY = barY;
  } else if (type === "PARENT_OF") {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 14,
    });
  } else if (type === "SIBLING_OF" && Math.abs(targetX - sourceX) > 260) {
    // distant siblings: arc above the row so the line doesn't pass behind
    // any cards sitting between them
    const midX = (sourceX + targetX) / 2;
    const arcY = Math.min(sourceY, targetY) - 110;
    path = `M ${sourceX} ${sourceY} Q ${midX} ${arcY} ${targetX} ${targetY}`;
    labelX = midX;
    labelY = (arcY + (sourceY + targetY) / 2) / 2;
  } else {
    [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  }

  const base = STYLE[type];
  const stroke = data?.assumed
    ? "#0d9488"
    : data?.highlighted
      ? disputed
        ? "#dc2626"
        : "#0f766e"
      : disputed
        ? "#dc2626"
        : base.stroke;
  // a step/foster tie or a former partnership is real but not a bloodline,
  // so it reads as a lighter, broken line. A partnership is never a bloodline
  // to begin with, so only "former" uses that faded dash — "partner"/"engaged"
  // get a tighter dash so they do not look like a marriage.
  const k = data?.kind as string | undefined;
  const partnerLike = type === "SPOUSE_OF" && (k === "partner" || k === "engaged");
  const softened =
    type === "SPOUSE_OF"
      ? k === "former"
      : !carriesLineage(type, data?.kind);
  const dash = data?.assumed
    ? "2 6"
    : disputed
      ? "7 5"
      : softened
        ? "9 6"
        : partnerLike
          ? "5 4"
          : base.dash;

  const hasTally = ((data?.confirms ?? 0) > 0 || disputed) && !data?.dimmed && !data?.assumed;

  return (
    <>
      <BaseEdge
        path={path}
        style={{
          stroke,
          strokeWidth: data?.highlighted ? 3 : selected ? 2.6 : 1.8,
          strokeDasharray: dash,
          strokeLinecap: data?.assumed ? "round" : undefined,
          opacity: data?.dimmed
            ? 0.08
            : softened || data?.assumed
              ? 0.55
              : partnerLike
                ? 0.7
                : selected || data?.highlighted
                  ? 1
                  : 0.85,
          transition: "opacity 0.2s ease, stroke-width 0.2s ease",
        }}
      />
      {hasTally && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className={`nodrag nopan pointer-events-none absolute flex items-center gap-1 rounded-full border bg-white px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ${
              disputed ? "border-red-200 text-red-600" : "border-stone-200 text-stone-500"
            }`}
          >
            {(data?.confirms ?? 0) > 0 && <span className="text-teal-700">+{data!.confirms}</span>}
            {disputed && <span>−{data!.disputes}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeInner);
