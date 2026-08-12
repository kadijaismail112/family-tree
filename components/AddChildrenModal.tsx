"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { spousesOf } from "@/lib/helpers";
import type { Gender, Person } from "@/lib/types";
import { GhostButton, inputCls, Modal, PrimaryButton, useToast } from "./ui";

interface Row {
  name: string;
  birthYear: string;
  gender: Gender | "";
}

const blank = (): Row => ({ name: "", birthYear: "", gender: "" });

/**
 * Adding a family one person at a time is the slowest part of building a
 * tree — every child means reopening the modal and re-picking the parents.
 * This keeps the parents fixed and takes a whole sibling set at once.
 */
export function AddChildrenModal({
  open,
  onClose,
  familyId,
  people,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  people: Person[];
  parentId: string | null;
}) {
  const { state, addChildren } = useStore();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank()]);
  const [secondParentId, setSecondParentId] = useState("");

  const parent = people.find((p) => p.id === parentId) ?? null;
  const spouseIds = parentId ? spousesOf(state.relationships, parentId) : [];

  useEffect(() => {
    if (!open) return;
    setRows([blank(), blank(), blank()]);
    setSecondParentId(spouseIds[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parentId]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const filled = rows.filter((r) => r.name.trim());
  const secondParent = people.find((p) => p.id === secondParentId) ?? null;

  const submit = () => {
    if (!parentId || filled.length === 0) return;
    const parentIds = secondParentId ? [parentId, secondParentId] : [parentId];
    const n = addChildren(
      familyId,
      parentIds,
      filled.map((r) => ({
        name: r.name,
        birthYear: r.birthYear,
        gender: r.gender || undefined,
      }))
    );
    toast(`Added ${n} ${n === 1 ? "child" : "children"}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={parent ? `Children of ${parent.name}` : "Add children"}
      subtitle="Add a whole set of siblings at once — they all get the same parents."
      wide
    >
      {people.filter((p) => p.id !== parentId).length > 0 && (
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            Other parent
          </span>
          <select
            className={inputCls}
            value={secondParentId}
            onChange={(e) => setSecondParentId(e.target.value)}
          >
            <option value="">Just {parent?.name.split(" ")[0] ?? "one parent"}</option>
            {people
              .filter((p) => p.id !== parentId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {spouseIds.includes(p.id) ? " (their spouse)" : ""}
                </option>
              ))}
          </select>
        </label>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr),86px,110px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          <span>Name</span>
          <span>Born</span>
          <span>Gender</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr),86px,110px] gap-2">
            <input
              autoFocus={i === 0}
              className={inputCls}
              placeholder={`Child ${i + 1}`}
              value={row.name}
              onChange={(e) => setRow(i, { name: e.target.value })}
              onKeyDown={(e) => {
                // Enter at the end of the list opens another row
                if (e.key === "Enter" && i === rows.length - 1 && row.name.trim()) {
                  e.preventDefault();
                  setRows((rs) => [...rs, blank()]);
                }
              }}
            />
            <input
              className={inputCls}
              placeholder="1994"
              inputMode="numeric"
              value={row.birthYear}
              onChange={(e) => setRow(i, { birthYear: e.target.value })}
            />
            <select
              className={inputCls}
              value={row.gender}
              onChange={(e) => setRow(i, { gender: e.target.value as Gender | "" })}
            >
              <option value="">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
        ))}
      </div>

      <button
        onClick={() => setRows((rs) => [...rs, blank()])}
        className="mt-2 rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-800/10"
      >
        + Another child
      </button>

      <p className="mt-3 text-xs leading-relaxed text-stone-500">
        {filled.length === 0
          ? "Type at least one name."
          : `${filled.length} ${filled.length === 1 ? "child" : "children"} will be added as ${
              secondParent
                ? `children of ${parent?.name} and ${secondParent.name}`
                : `children of ${parent?.name}`
            }.`}
      </p>

      <div className="mt-4 flex justify-end gap-2.5">
        <GhostButton type="button" onClick={onClose}>
          Cancel
        </GhostButton>
        <PrimaryButton onClick={submit} disabled={filled.length === 0}>
          Add {filled.length || ""} {filled.length === 1 ? "child" : "children"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
