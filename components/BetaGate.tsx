"use client";

import { useState } from "react";
import { PrimaryButton } from "./ui";

/**
 * A notice over a feature that isn't finished, shown every time the feature is
 * opened.
 *
 * Deliberately not remembered. A one-time notice is for a change someone needs
 * to learn once; this is a standing warning that the data on screen may be
 * wrong, and that stays true on the fiftieth visit. It is dismissed per visit,
 * so it costs a click rather than blocking use.
 *
 * It blurs what's behind rather than hiding it, so there's something worth
 * agreeing to look at.
 */
export function BetaGate({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute inset-0 z-30 flex items-center justify-center bg-stone-900/20 p-6 backdrop-blur-sm"
    >
      <div className="animate-rise w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-xl shadow-stone-900/10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          Beta
        </span>
        <h2 className="font-display mt-3 text-xl font-semibold text-stone-900">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-stone-600">
          {children}
        </div>
        <PrimaryButton onClick={() => setDismissed(true)} className="mt-5 w-full">
          Got it — let me in
        </PrimaryButton>
      </div>
    </div>
  );
}
