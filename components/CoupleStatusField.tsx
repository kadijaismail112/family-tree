"use client";

import { useStore } from "@/lib/store";
import type { CoupleStatus } from "@/lib/types";
import { Segmented, useAction } from "./ui";

const OPTIONS: { value: CoupleStatus; label: string }[] = [
  { value: "married", label: "Married" },
  { value: "partner", label: "Partners" },
  { value: "none", label: "Not a couple" },
];

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * The question that decides whether two parents sit as a married pair, as
 * partners, or just as the child's parents. Required whenever the tree is
 * about to record a second parent who isn't already a spouse of the first.
 */
export function CoupleStatusField({
  aName,
  bName,
  value,
  onChange,
}: {
  aName: string;
  bName: string;
  value: CoupleStatus | "";
  onChange: (value: CoupleStatus) => void;
}) {
  return (
    <div className="mt-2.5">
      <Segmented<CoupleStatus | "">
        label={`Are ${firstName(aName)} and ${firstName(bName)} a couple?`}
        hint="required"
        value={value}
        onChange={(v) => {
          if (v) onChange(v);
        }}
        options={OPTIONS}
      />
      <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
        {value === "married"
          ? "They'll sit together with a marriage bar, the way a married couple is drawn."
          : value === "partner"
            ? "Partners, not married — they'll sit together without looking like a marriage."
            : value === "none"
              ? "They had a child together. They'll sit next to each other, not as a married pair."
              : "This decides whether they're drawn as a couple or just as the child's parents."}
      </p>
    </div>
  );
}

/**
 * Shared-child suggestions used to be Confirm (writes married) or Deny.
 * That silently turned every unmarried co-parent into a spouse. These three
 * answers are the same choice the add forms ask.
 */
export function CoupleSuggestionActions({
  familyId,
  fromPersonId,
  toPersonId,
  suggestionKey,
  disabled,
  compact,
}: {
  familyId: string;
  fromPersonId: string;
  toPersonId: string;
  suggestionKey: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { addRelationship, dismissSuggestion } = useStore();
  const { run, pending } = useAction();
  const busy = disabled || pending;

  const marry = (kind: "married" | "partner", success: string) =>
    void run(
      () =>
        addRelationship(familyId, fromPersonId, toPersonId, "SPOUSE_OF", kind, {
          alsoConfirm: true,
        }),
      { success, failure: "Couldn't add that" }
    );

  const btn =
    "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50";

  return (
    <div className={compact ? "flex flex-wrap justify-end gap-1" : "mt-2 flex flex-wrap gap-1.5"}>
      <button
        type="button"
        disabled={busy}
        onClick={() => marry("married", "Marked as married")}
        className={`${btn} bg-teal-800 text-white hover:bg-teal-700`}
      >
        Married
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => marry("partner", "Marked as partners")}
        className={`${btn} border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50`}
      >
        Partners
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(() => dismissSuggestion(familyId, suggestionKey), {
            success: "Not a couple — they stay the child's parents",
            failure: "Couldn't dismiss that",
          })
        }
        className={`${btn} border border-stone-200 bg-white text-stone-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600`}
      >
        Not a couple
      </button>
    </div>
  );
}
