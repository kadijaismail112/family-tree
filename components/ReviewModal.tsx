"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { allSuggestions, type Suggestion } from "@/lib/suggestions";
import { useState } from "react";
import { Modal, PrimaryButton, useAction, useToast } from "./ui";

/**
 * A queue for every assumed connection in the family. Without this the only
 * way to find them is to click each person in turn — unworkable once a tree
 * has dozens of pending guesses.
 */
export function ReviewModal({
  open,
  onClose,
  familyId,
  onGoToPerson,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  onGoToPerson: (personId: string) => void;
}) {
  const { state, addRelationship, dismissSuggestion } = useStore();
  const toast = useToast();
  const { run, pending } = useAction();

  const suggestions = useMemo(
    () =>
      allSuggestions(
        state.relationships.filter((r) => r.familyId === familyId),
        state.dismissedSuggestions
      ),
    [state.relationships, state.dismissedSuggestions, familyId]
  );

  const nameOf = (id: string) =>
    state.people.find((p) => p.id === id)?.name ?? "Someone";
  const first = (id: string) => nameOf(id).split(" ")[0];

  const label = (s: Suggestion) =>
    s.type === "PARENT_OF"
      ? `${nameOf(s.fromPersonId)} is a parent of ${nameOf(s.toPersonId)}`
      : s.type === "SIBLING_OF"
        ? `${nameOf(s.fromPersonId)} and ${nameOf(s.toPersonId)} are siblings`
        : `${nameOf(s.fromPersonId)} and ${nameOf(s.toPersonId)} are a couple`;

  const reason = (s: Suggestion) =>
    s.reasonKind === "siblingsParent"
      ? `${first(s.viaPersonId)} is their sibling`
      : s.reasonKind === "sharedParent"
        ? `both children of ${nameOf(s.viaPersonId)}`
        : s.reasonKind === "sharedSibling"
          ? `both siblings of ${first(s.viaPersonId)}`
          : `both parents of ${first(s.viaPersonId)}`;

  // Bulk-confirming asserts every one of these under your name, so it takes
  // a deliberate second press rather than a single click.
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmAll = async () => {
    if (busy) return;
    setBusy(true);
    const total = suggestions.length;
    let added = 0;
    let firstError: string | null = null;
    for (const s of suggestions) {
      try {
        const res = await addRelationship(familyId, s.fromPersonId, s.toPersonId, s.type, undefined, {
          alsoConfirm: true,
        });
        if (res.ok) added++;
        else firstError ??= res.error ?? null;
      } catch (err) {
        firstError ??= err instanceof Error ? err.message : null;
      }
    }
    setBusy(false);
    setArmed(false);
    // Reporting the whole batch as done when part of it failed would leave
    // people believing connections exist that don't.
    if (added === total) {
      toast(`${total} ${total === 1 ? "connection" : "connections"} added and confirmed by you`);
    } else if (added === 0) {
      toast(firstError ?? "Couldn't add those connections", "error");
    } else {
      toast(`Added ${added} of ${total}. ${firstError ?? "The rest didn't go through."}`, "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assumed connections"
      subtitle={
        suggestions.length
          ? "These follow from what's already recorded. Nothing is added until you confirm."
          : undefined
      }
      size="lg"
    >
      {suggestions.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-display text-lg text-stone-900">All caught up</p>
          <p className="mt-1 text-sm text-stone-500">
            No assumptions are waiting on you right now.
          </p>
        </div>
      ) : (
        <>
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-0.5">
            {suggestions.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2"
              >
                <button
                  onClick={() => {
                    onGoToPerson(s.audience[0]);
                    onClose();
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm text-stone-800">
                    {label(s)}
                  </span>
                  <span className="block truncate text-[11px] text-stone-400">
                    {reason(s)}
                  </span>
                </button>
                <button
                  disabled={pending || busy}
                  onClick={() =>
                    void run(
                      () =>
                        addRelationship(
                          familyId,
                          s.fromPersonId,
                          s.toPersonId,
                          s.type,
                          undefined,
                          { alsoConfirm: true }
                        ),
                      { success: "Connection added", failure: "Couldn't add that" }
                    )
                  }
                  aria-label="Confirm"
                  title="Confirm"
                  className="shrink-0 rounded-lg bg-teal-800 p-1.5 text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </button>
                <button
                  disabled={pending || busy}
                  onClick={() =>
                    void run(() => dismissSuggestion(familyId, s.key), {
                      failure: "Couldn't dismiss that",
                    })
                  }
                  aria-label="Deny"
                  title="Deny"
                  className="shrink-0 rounded-lg border border-stone-200 p-1.5 text-stone-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-stone-100 pt-3">
            {armed && (
              <p className="mb-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800">
                All {suggestions.length} will be added as asserted by you, and
                anyone in the family can dispute them afterwards.
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400">
                {suggestions.length} waiting
              </span>
              <div className="flex gap-2">
                {armed && (
                  <button
                    onClick={() => setArmed(false)}
                    className="rounded-xl px-3 py-2 text-xs font-medium text-stone-500 transition hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                )}
                <PrimaryButton
                  onClick={() => (armed ? void confirmAll() : setArmed(true))}
                  disabled={busy || pending}
                  className="!py-2 text-xs"
                >
                  {busy
                    ? "Adding…"
                    : armed
                      ? `Yes, add all ${suggestions.length}`
                      : "Confirm all"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
