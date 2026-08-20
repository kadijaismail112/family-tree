"use client";

import { useEffect, useMemo, useState } from "react";
import { INVITE_DAYS, useStore } from "@/lib/store";
import { Avatar, GhostButton, Modal, PrimaryButton, useToast } from "./ui";

/**
 * Hands a member a link to send one specific relative.
 *
 * The link is personal: it names the node the recipient will claim, so
 * accepting it puts them in the tree in the right place rather than dropping
 * them into a family to find themselves. It works once and expires, which is
 * why this mints on demand instead of showing a standing code.
 *
 * Opened from a person, it goes straight to the link. Opened from the toolbar,
 * it asks who first — there is no such thing as a family-wide invite any more.
 */
export function InvitePersonModal({
  open,
  familyId,
  personId,
  onClose,
}: {
  open: boolean;
  familyId: string;
  personId?: string;
  onClose: () => void;
}) {
  const { state, createPersonInvite } = useStore();
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (open) setChosen(personId ?? null);
  }, [open, personId]);

  // Someone who already has an account can't be invited into it again.
  const invitable = useMemo(
    () =>
      state.people
        .filter((p) => p.familyId === familyId && !p.accountUserId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.people, familyId]
  );

  const target = chosen ? state.people.find((p) => p.id === chosen) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? `Invite ${target.name}` : "Invite a relative"}
    >
      {target ? (
        <InviteLink
          personId={target.id}
          personName={target.name}
          create={createPersonInvite}
          onBack={personId ? undefined : () => setChosen(null)}
        />
      ) : (
        <>
          <p className="text-sm leading-relaxed text-stone-500">
            Who are you inviting? They&apos;ll get a link to join as themselves
            and fill in their own details.
          </p>
          {invitable.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-stone-400">
              Everyone on this tree has already joined. Add a relative first,
              then invite them.
            </p>
          ) : (
            <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
              {invitable.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setChosen(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-teal-800/5"
                  >
                    <Avatar name={p.name} id={p.id} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-800">
                        {p.name}
                      </span>
                      {p.birthYear && (
                        <span className="block text-xs text-stone-400">b. {p.birthYear}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

function InviteLink({
  personId,
  personName,
  create,
  onBack,
}: {
  personId: string;
  personName: string;
  create: (personId: string, days?: number) => Promise<string>;
  onBack?: () => void;
}) {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLink(null);
    setError(null);
    setCopied(false);
    create(personId)
      .then((url) => {
        if (!cancelled) setLink(url);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [personId, create, attempt]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy — select the link and copy it by hand", "error");
    }
  };

  const share = async () => {
    if (!link) return;
    try {
      // The share sheet is what makes "text it to them" a single tap on a phone.
      await navigator.share({
        title: "Join our family tree",
        text: `Join our family tree on Dynasty — I've added you as ${personName}:`,
        url: link,
      });
    } catch {
      // Dismissing the sheet lands here too, so this stays silent.
    }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <>
      <p className="text-sm leading-relaxed text-stone-500">
        Send this to {personName}. It lets them create an account, fill in their
        own details, and join this tree as themselves.
      </p>

      {error ? (
        <div className="mt-4">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          <PrimaryButton className="mt-3 w-full" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </PrimaryButton>
        </div>
      ) : !link ? (
        <div className="mt-4 h-11 animate-pulse rounded-xl bg-stone-100" />
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`Invite link for ${personName}`}
              className="w-full bg-transparent font-mono text-xs text-stone-600 outline-none"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <PrimaryButton className="flex-1" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </PrimaryButton>
            {canShare && (
              <GhostButton className="flex-1" onClick={share}>
                Share…
              </GhostButton>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-stone-400">
            Works once, and expires in {INVITE_DAYS} days. Sending a new link
            replaces this one, so an older link stops working.
          </p>
        </>
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 text-xs text-stone-400 underline underline-offset-2 transition hover:text-stone-600"
        >
          Invite someone else instead
        </button>
      )}
    </>
  );
}
