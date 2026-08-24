"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { spousesOf } from "@/lib/helpers";
import type { Gender, Person } from "@/lib/types";
import { Field, GhostButton, inputCls, Modal, PrimaryButton, useAction, useToast } from "./ui";
import { PersonPicker } from "./PersonPicker";
import { GeezInput } from "./GeezInput";

const RELATION_OPTIONS = [
  { value: "child", label: "Child of" },
  { value: "parent", label: "Parent of" },
  { value: "spouse", label: "Spouse of" },
  { value: "sibling", label: "Sibling of" },
] as const;

type Kind = (typeof RELATION_OPTIONS)[number]["value"];

export function AddMemberModal({
  open,
  onClose,
  familyId,
  people,
  anchorPersonId,
  onAdded,
  mePersonId,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  people: Person[];
  anchorPersonId?: string | null;
  onAdded?: (personId: string) => void;
  mePersonId?: string | null;
}) {
  const { state, addPerson, claimPerson } = useStore();
  const toast = useToast();
  const { run, pending } = useAction();

  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<Kind>("child");
  const [anchorId, setAnchorId] = useState<string>("");
  const [gender, setGender] = useState<Gender | "">("");
  const [secondParentId, setSecondParentId] = useState<string>("");
  const [thisIsMe, setThisIsMe] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setBirthYear("");
      setDeathYear("");
      setNotes("");
      setKind("child");
      setGender("");
      setAnchorId(anchorPersonId ?? people[0]?.id ?? "");
      // First person in an empty tree is usually the member themselves.
      setThisIsMe(!mePersonId && people.length === 0);
    }
  }, [open, anchorPersonId, people, mePersonId]);

  // default the second parent to the anchor's spouse whenever the anchor
  // changes while adding a child
  const anchorSpouseId = useMemo(() => {
    if (!anchorId) return "";
    return spousesOf(state.relationships, anchorId)[0] ?? "";
  }, [state.relationships, anchorId]);

  useEffect(() => {
    if (open && kind === "child") setSecondParentId(anchorSpouseId);
  }, [open, kind, anchorId, anchorSpouseId]);

  const canConnect = people.length > 0;

  // A tree full of "Meron"s is easy to create by accident, so flag a name
  // that already exists rather than silently making a second one.
  const duplicates = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return [];
    return people.filter((p) => p.name.trim().toLowerCase() === q);
  }, [name, people]);
  const secondParentOptions = people.filter((p) => p.id !== anchorId);

  const submit = () =>
    run(async () => {
      const person = await addPerson(familyId, {
        name,
        birthYear,
        deathYear,
        notes,
        gender: gender || undefined,
        relation:
          canConnect && anchorId
            ? {
                anchorPersonId: anchorId,
                kind,
                secondParentId:
                  kind === "child" && secondParentId ? secondParentId : undefined,
              }
            : undefined,
      });
      // Only reached when the person and their connection both landed, so a
      // half-finished add leaves the form open with the reason on screen.
      if (thisIsMe && !mePersonId) {
        try {
          await claimPerson(person.id);
          toast(`${person.name} is you — the tree now reads from your place`);
        } catch (err) {
          toast(
            err instanceof Error ? err.message : "Added, but couldn't mark them as you",
            "error"
          );
        }
      } else {
        toast(`Added ${person.name} to the tree`);
      }
      onAdded?.(person.id);
      onClose();
    }, { failure: "Couldn't add that person" });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a family member"
      subtitle={
        people.length === 0
          ? "Every tree starts with one person. If this is you, leave that marked."
          : "They don't need an account — you're adding their place in the tree."
      }
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void submit();
        }}
        className="space-y-5"
      >
        <Field label="Full name">
          <GeezInput
            autoFocus
            placeholder="e.g. Rosa Delgado"
            value={name}
            onChange={setName}
          />
        </Field>

        {duplicates.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-3.5 py-2.5">
            <p className="text-sm font-medium text-amber-900">
              {duplicates.length === 1
                ? "Someone with this name is already in the tree"
                : `${duplicates.length} people with this name are already in the tree`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {duplicates.map((d) => (
                <li key={d.id} className="text-xs text-amber-800">
                  {d.name}
                  {d.birthYear ? ` · b. ${d.birthYear}` : ""}
                  {d.details?.currentCity ? ` · ${d.details.currentCity}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-amber-700">
              Carry on if this is a different person — families reuse names. To
              link the existing one instead, close this and use “Connect to
              someone”.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Birth year" hint="optional">
            <input
              className={inputCls}
              placeholder="1954"
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </Field>
          <Field label="Death year" hint="optional">
            <input
              className={inputCls}
              placeholder="—"
              inputMode="numeric"
              value={deathYear}
              onChange={(e) => setDeathYear(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Gender" hint="only used for wording">
          <select
            className={inputCls}
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
          >
            <option value="">Not recorded</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>

        {canConnect && (
          <fieldset className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
            <legend className="px-1.5 text-sm font-medium text-stone-700">
              How are they related?
            </legend>
            <div className="space-y-2.5">
              <select
                className={inputCls}
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
              >
                {RELATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <PersonPicker
                people={people}
                value={anchorId}
                onChange={setAnchorId}
                mePersonId={mePersonId}
              />
            </div>
            {kind === "child" && secondParentOptions.length > 0 && (
              <div className="mt-2.5">
                <span className="mb-1 block text-xs font-medium text-stone-600">
                  …and also child of
                </span>
                <PersonPicker
                  people={secondParentOptions}
                  value={secondParentId}
                  onChange={setSecondParentId}
                  mePersonId={mePersonId}
                  noneLabel="No second parent (for now)"
                />
              </div>
            )}
            <p className="mt-2.5 text-xs leading-relaxed text-stone-500">
              This creates {kind === "child" && secondParentId ? "connections" : "a connection"} the
              rest of the family can confirm. You can add more later.
            </p>
          </fieldset>
        )}

        <Field label="Notes" hint="optional">
          <textarea
            className={`${inputCls} min-h-[72px] resize-y`}
            placeholder="A story, where they lived, anything worth remembering…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {!mePersonId && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-teal-700/25 bg-teal-800/5 px-3.5 py-3">
            <input
              type="checkbox"
              checked={thisIsMe}
              onChange={(e) => setThisIsMe(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-teal-800"
            />
            <span>
              <span className="block text-sm font-semibold text-teal-900">
                This is me
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
                Claim this node so the tree can say how everyone relates to you.
              </span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <GhostButton type="button" onClick={onClose}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" disabled={!name.trim() || pending}>
            {pending ? "Adding…" : "Add to tree"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
