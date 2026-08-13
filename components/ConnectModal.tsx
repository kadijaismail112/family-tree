"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { parentsOf, spousesOf } from "@/lib/helpers";
import type { Person, RelationKind, RelationType } from "@/lib/types";
import { kindsFor, defaultKind } from "@/lib/types";
import { Field, GhostButton, inputCls, Modal, PrimaryButton, useToast } from "./ui";
import { PersonPicker } from "./PersonPicker";

export function ConnectModal({
  open,
  onClose,
  familyId,
  people,
  initialFromId,
  mePersonId,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  people: Person[];
  initialFromId?: string | null;
  mePersonId?: string | null;
}) {
  const { state, addRelationship } = useStore();
  const toast = useToast();

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [type, setType] = useState<RelationType>("PARENT_OF");
  const [kind, setKind] = useState<RelationKind>("biological");
  const [includeCoParent, setIncludeCoParent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      // The second slot stays empty on purpose: pre-filling it with whoever
      // happened to be first in the list invites a connection nobody meant.
      setFromId(initialFromId ?? "");
      setToId("");
      setType("PARENT_OF");
      setIncludeCoParent(true);
      setError(null);
    }
  }, [open, initialFromId, people]);

  // when recording a parent, offer their spouse as the other parent in one go
  const coParent = useMemo(() => {
    if (type !== "PARENT_OF" || !fromId || !toId) return null;
    const spouseId = spousesOf(state.relationships, fromId).find(
      (id) => id !== toId && !parentsOf(state.relationships, toId).includes(id)
    );
    return spouseId ? people.find((p) => p.id === spouseId) ?? null : null;
  }, [type, fromId, toId, state.relationships, people]);

  const child = people.find((p) => p.id === toId);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addRelationship(familyId, fromId, toId, type, kind, {
        alsoConfirm: true,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't create that connection.");
        return;
      }
      // The second parent is a separate edge and can fail on its own. Saying
      // "both parents connected" without checking would be a lie half the time
      // it matters, so the message follows what actually landed.
      if (coParent && includeCoParent) {
        const second = await addRelationship(familyId, coParent.id, toId, "PARENT_OF");
        if (!second.ok) {
          setError(
            `${child?.name ?? "They"} is now connected to ${people.find((p) => p.id === fromId)?.name ?? "the first parent"}, but ${coParent.name} couldn't be added as the second parent: ${second.error ?? "unknown error"}`
          );
          return;
        }
        toast("Both parents connected — the family can now weigh in");
      } else {
        toast("Connection added — the family can now weigh in");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect two people"
      subtitle="Draw a branch between people already in the tree."
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <PersonPicker
          label="This person…"
          people={people}
          value={fromId}
          mePersonId={mePersonId}
          disabledIds={toId ? [toId] : undefined}
          onChange={(id) => {
            setFromId(id);
            setError(null);
          }}
        />

        <Field label="…is the…">
          <select
            className={inputCls}
            value={type}
            onChange={(e) => {
              const t = e.target.value as RelationType;
              setType(t);
              setKind(defaultKind(t));
              setError(null);
            }}
          >
            <option value="PARENT_OF">parent of</option>
            <option value="SPOUSE_OF">spouse of</option>
            <option value="SIBLING_OF">sibling of</option>
          </select>
        </Field>

        <Field label="Kind">
          <select
            className={inputCls}
            value={kind}
            onChange={(e) => setKind(e.target.value as RelationKind)}
          >
            {kindsFor(type).map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        <PersonPicker
          label="…this person"
          people={people}
          value={toId}
          mePersonId={mePersonId}
          disabledIds={fromId ? [fromId] : undefined}
          onChange={(id) => {
            setToId(id);
            setError(null);
          }}
        />

        {coParent && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-teal-700/25 bg-teal-800/5 px-3.5 py-3">
            <input
              type="checkbox"
              checked={includeCoParent}
              onChange={(e) => setIncludeCoParent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-teal-800"
            />
            <span className="text-sm leading-snug text-stone-700">
              Also make <span className="font-semibold">{coParent.name}</span> a
              parent of <span className="font-semibold">{child?.name}</span>
              <span className="block text-xs text-stone-400">
                They&apos;re recorded as the spouse — most children belong to both.
              </span>
            </span>
          </label>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <GhostButton type="button" onClick={onClose}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" disabled={busy || !fromId || !toId || fromId === toId}>
            {busy ? "Connecting…" : "Connect"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
