"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  asDetailKey,
  canonicalClusterValue,
  clusterOptionLabel,
  peopleInCluster,
  type WritableClusterKey,
} from "@/lib/cluster";
import { personMatches, sortedPeople } from "@/lib/helpers";
import type { Person } from "@/lib/types";
import { PERSON_DETAIL_FIELDS } from "@/lib/types";
import { Avatar, Field, GhostButton, inputCls, Modal, PrimaryButton, useAction } from "./ui";
import { CityInput } from "./CityInput";

export function ClusterModal({
  open,
  onClose,
  onCreated,
  clusterKey,
  existingLabel,
  people,
  mePersonId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  clusterKey: WritableClusterKey;
  /** set when adding to an existing bubble */
  existingLabel?: string | null;
  people: Person[];
  mePersonId?: string | null;
}) {
  const { setPersonDetail } = useStore();
  const { run, pending } = useAction();
  const creating = !existingLabel;
  const fieldLabel = clusterOptionLabel(clusterKey);
  const fieldKind =
    PERSON_DETAIL_FIELDS.find((f) => f.key === clusterKey)?.kind ?? "text";

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const members = useMemo(
    () => (existingLabel ? peopleInCluster(people, clusterKey, existingLabel) : []),
    [people, clusterKey, existingLabel]
  );
  const memberIds = useMemo(() => new Set(members.map((p) => p.id)), [members]);

  const candidates = useMemo(() => {
    const pool = people.filter((p) => !memberIds.has(p.id));
    const ordered = sortedPeople(pool, mePersonId);
    const q = query.trim();
    return q ? ordered.filter((p) => personMatches(p, q)) : ordered;
  }, [people, memberIds, mePersonId, query]);

  useEffect(() => {
    if (!open) return;
    setName(existingLabel ?? "");
    setQuery("");
    setPicked(new Set());
  }, [open, existingLabel]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const value = (existingLabel
    ? canonicalClusterValue(people, clusterKey, existingLabel)
    : name
  ).trim();

  const submit = () => {
    if (!value || picked.size === 0) return;
    const ids = Array.from(picked);
    return run(
      async () => {
        for (const id of ids) {
          await setPersonDetail(id, asDetailKey(clusterKey), value);
        }
      },
      {
        success: creating
          ? ids.length === 1
            ? "Cluster created"
            : `Cluster created with ${ids.length} people`
          : ids.length === 1
            ? `Added ${people.find((p) => p.id === ids[0])?.name.split(" ")[0] ?? "them"}`
            : `Added ${ids.length} people`,
        failure: creating ? "Couldn't create that cluster" : "Couldn't add those people",
      }
    ).then((ok) => {
      if (ok) {
        if (creating) onCreated?.();
        onClose();
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={creating ? "New cluster" : `Add to ${existingLabel}`}
      subtitle={
        creating
          ? "Name a group and pick who belongs. It lives under Groups, whichever view you’re in."
          : clusterKey === "clusterGroup"
            ? `Adds them to ${existingLabel}.`
            : `Sets ${fieldLabel.toLowerCase()} to ${existingLabel}. Anyone already somewhere else will move.`
      }
      size="lg"
    >
      {creating && (
        <div className="mb-4">
          <Field label="Name">
            {fieldKind === "city" ? (
              <CityInput
                value={name}
                onChange={setName}
                placeholder="Name this cluster"
                autoFocus
              />
            ) : (
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this cluster"
                autoFocus
              />
            )}
          </Field>
        </div>
      )}

      {members.length > 0 && (
        <p className="mb-3 text-xs text-stone-500">
          {members.length} {members.length === 1 ? "person is" : "people are"} already
          here
          {members.length <= 4
            ? `: ${members.map((p) => p.name.split(" ")[0]).join(", ")}`
            : ""}
          .
        </p>
      )}

      <Field label="People to add" hint={`${picked.size} selected`}>
        <input
          className={inputCls}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
        />
      </Field>

      <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-stone-200">
        {candidates.length === 0 ? (
          <li className="px-3.5 py-6 text-center text-sm text-stone-400">
            {query.trim()
              ? "No matches."
              : members.length === people.length
                ? "Everyone is already in this cluster."
                : "No one left to add."}
          </li>
        ) : (
          candidates.map((p) => {
            const on = picked.has(p.id);
            return (
              <li key={p.id} className="border-b border-stone-100 last:border-0">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                    on ? "bg-teal-800/[0.06]" : "hover:bg-stone-50"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      on
                        ? "border-teal-800 bg-teal-800 text-white"
                        : "border-stone-300 bg-white"
                    }`}
                    aria-hidden
                  >
                    {on && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  <Avatar name={p.name} id={p.id} size={32} src={p.photoUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-stone-800">
                      {p.name}
                    </span>
                    {p.details?.[clusterKey] && (
                      <span className="block truncate text-[11px] text-stone-400">
                        currently {p.details[clusterKey]}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-5 flex justify-end gap-2">
        <GhostButton type="button" onClick={onClose} disabled={pending}>
          Cancel
        </GhostButton>
        <PrimaryButton
          type="button"
          onClick={() => void submit()}
          disabled={pending || !value || picked.size === 0}
        >
          {pending
            ? "Saving…"
            : creating
              ? `Create cluster`
              : picked.size === 1
                ? "Add 1 person"
                : `Add ${picked.size} people`}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
