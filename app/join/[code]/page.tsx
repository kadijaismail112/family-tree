"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { CURRENT_USER_ID } from "@/lib/seed";
import { PrimaryButton, useToast } from "@/components/ui";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const { state, hydrated, joinFamilyByCode } = useStore();
  const router = useRouter();
  const toast = useToast();

  if (!hydrated) return <div className="min-h-screen bg-stone-50" />;

  const invite = state.invites.find(
    (i) => i.code.toLowerCase() === decodeURIComponent(code).toLowerCase()
  );
  const family = invite
    ? state.families.find((f) => f.id === invite.familyId)
    : undefined;
  const alreadyMember =
    family &&
    state.memberships.some(
      (m) => m.familyId === family.id && m.userId === CURRENT_USER_ID
    );
  const memberCount = family
    ? state.memberships.filter((m) => m.familyId === family.id).length
    : 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <div className="animate-rise w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xl">
        {!invite || !family ? (
          <>
            <h1 className="font-display text-2xl font-semibold text-stone-900">
              This invite isn&apos;t valid
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              The code <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">{decodeURIComponent(code)}</code>{" "}
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
              {family.name}
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
                  href={`/family/${family.id}`}
                  className="mt-4 inline-block rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Open the tree
                </Link>
              </>
            ) : (
              <PrimaryButton
                className="mt-6 w-full"
                onClick={() => {
                  const res = joinFamilyByCode(decodeURIComponent(code));
                  if (res.ok || res.familyId) {
                    toast(`Welcome to ${family.name}!`);
                    router.push(`/family/${family.id}`);
                  }
                }}
              >
                Join {family.name}
              </PrimaryButton>
            )}
          </>
        )}
      </div>
    </main>
  );
}
