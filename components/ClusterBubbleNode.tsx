"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";

export interface ClusterBubbleData {
  label: string;
  count: number;
  muted: boolean;
  size: number;
  interactive?: boolean;
  onAdd?: () => void;
}

function ClusterBubbleInner({ data }: NodeProps<ClusterBubbleData>) {
  return (
    <div
      className="pointer-events-none relative rounded-full border-2 border-dashed border-teal-700/25 bg-teal-800/[0.045]"
      style={{ width: data.size, height: data.size }}
    >
      <span
        className={`absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-teal-900 shadow-sm ring-1 ring-teal-800/20 ${
          data.interactive ? "pointer-events-auto" : ""
        }`}
      >
        {data.label}
        <span className="text-teal-700/60">{data.count}</span>
        {data.interactive && data.onAdd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onAdd?.();
            }}
            className="ml-0.5 rounded-full bg-teal-800 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-teal-700"
          >
            Add
          </button>
        )}
      </span>
    </div>
  );
}

export const ClusterBubbleNode = memo(ClusterBubbleInner);
