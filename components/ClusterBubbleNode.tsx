"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";

export interface ClusterBubbleData {
  label: string;
  count: number;
  muted: boolean;
  size: number;
}

function ClusterBubbleInner({ data }: NodeProps<ClusterBubbleData>) {
  return (
    <div
      className={`pointer-events-none relative rounded-full border-2 border-dashed ${
        data.muted
          ? "border-stone-200 bg-stone-100/40"
          : "border-teal-700/25 bg-teal-800/[0.045]"
      }`}
      style={{ width: data.size, height: data.size }}
    >
      <span
        className={`absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold shadow-sm ring-1 ${
          data.muted
            ? "bg-white text-stone-400 ring-stone-200"
            : "bg-white text-teal-900 ring-teal-800/20"
        }`}
      >
        {data.label}
        <span className={`ml-1.5 ${data.muted ? "text-stone-300" : "text-teal-700/60"}`}>
          {data.count}
        </span>
      </span>
    </div>
  );
}

export const ClusterBubbleNode = memo(ClusterBubbleInner);
