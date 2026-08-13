"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { GhostButton, Modal, useToast } from "./ui";

export function InviteModal({
  open,
  onClose,
  familyId,
  familyName,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  familyName: string;
}) {
  const { createInvite } = useStore();
  const toast = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    createInvite(familyId)
      .then((c) => {
        if (!cancelled) setCode(c);
      })
      .catch((err: Error) => {
        // Otherwise the code and link sit on "…" forever with no hint that
        // anything went wrong.
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, familyId, createInvite, attempt]);

  const link =
    code && typeof window !== "undefined"
      ? `${window.location.origin}/join/${code}`
      : "";

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast("Couldn't copy — select it manually", "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite your family"
      subtitle={`Anyone with this link can join ${familyName} and help grow the tree.`}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
              className="mt-1.5 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">Invite link</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 font-mono text-[13px] text-stone-700">
              {link || "…"}
            </code>
            <GhostButton onClick={() => link && copy(link, "Link")} className="shrink-0 !px-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </GhostButton>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">
            Or share just the code
          </p>
          <button
            onClick={() => code && copy(code, "Code")}
            className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-2 font-mono text-sm font-semibold tracking-wider text-teal-800 transition hover:border-teal-700/50 hover:bg-teal-800/5"
          >
            {code ?? "…"}
          </button>
        </div>

        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800">
          This link doesn&apos;t expire, so only share it with family. Everyone who
          joins can add and edit people, and confirm or dispute connections — there
          are no admins here.
        </p>
      </div>
    </Modal>
  );
}
