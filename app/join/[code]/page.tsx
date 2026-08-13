"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { LoadingScreen, PrimaryButton, useToast } from "@/components/ui";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const { state, hydrated, currentUser, joinFamilyByCode, peekInvite } = useStore();
  const router = useRouter();
  const toast = useToast();
  const raw = decodeURIComponent(code);

  const [peek, setPeek] = useState<{
    familyId: string;
    familyName: string;
    memberCount: number;
  } | null | undefined>(undefined);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);

  // Middleware normally sends signed-out visitors to /login?next=here, but if
  // it ever lets one through this page would wait for a session that is never
  // coming and show nothing at all. Sending them to sign in keeps the invite.
  useEffect(() => {
    if (!hydrated || currentUser) return;
    router.replace(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  }, [hydrated, currentUser, code, router]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    let cancelled = false;
    setLookupFailed(false);
    peekInvite(raw)
      .then((row) => {
        if (!cancelled) setPeek(row);
      })
      .catch(() => {
        // A code that doesn't exist and a request that didn't arrive are not
        // the same thing; telling someone their good invite is invalid is how
        // they give up on it.
        if (!cancelled) setLookupFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, currentUser, raw, peekInvite, attempt]);

  if (!hydrated || !currentUser || (peek === undefined && !lookupFailed)) {
    return <LoadingScreen label="Checking your invite…" />;
  }

  if (lookupFailed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <div className="animate-rise w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xl">
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            We couldn&apos;t check that invite
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Something went wrong reaching the server. The invite is probably
            fine — try again in a moment.
          </p>
          <PrimaryButton
            className="mt-6 w-full"
            onClick={() => {
              setLookupFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </PrimaryButton>
        </div>
      </main>
    );
  }

  const alreadyMember =
    peek &&
    currentUser &&
    state.memberships.some(
      (m) => m.familyId === peek.familyId && m.userId === currentUser.id
    );
  const memberCount = peek?.memberCount ?? 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <div className="animate-rise w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xl">
        {!peek ? (
          <>
            <h1 className="font-display text-2xl font-semibold text-stone-900">
              This invite isn&apos;t valid
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              The code <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">{raw}</code>{" "}
              doesn&apos;t match any family. Ask your relative to send a fresh link.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Go to your families
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
              You&apos;re invited
            </p>
            <h1 className="font-display mt-2 text-2xl font-semibold text-stone-900">
              {peek.familyName}
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              {memberCount} {memberCount === 1 ? "member is" : "members are"} already
              growing this tree. Join in to add relatives, share stories, and vouch
              for what&apos;s true.
            </p>
            {alreadyMember ? (
              <>
                <p className="mt-5 rounded-xl bg-teal-800/5 px-4 py-3 text-sm text-teal-900">
                  You&apos;re already a member of this family.
                </p>
                <Link
                  href={`/family/${peek.familyId}`}
                  className="mt-4 inline-block rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Open the tree
                </Link>
              </>
            ) : (
              <PrimaryButton
                className="mt-6 w-full"
                disabled={joining}
                onClick={async () => {
                  setJoining(true);
                  const res = await joinFamilyByCode(raw);
                  setJoining(false);
                  if (res.ok && res.familyId) {
                    toast(`Welcome to ${peek.familyName}!`);
                    router.push(`/family/${res.familyId}`);
                  } else {
                    toast(res.error ?? "Couldn't join that family", "error");
                  }
                }}
              >
                {joining ? "Joining…" : `Join ${peek.familyName}`}
              </PrimaryButton>
            )}
          </>
        )}
      </div>
    </main>
  );
}
