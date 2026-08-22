"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Avatar, LoadingScreen } from "@/components/ui";

/**
 * Account settings.
 *
 * The controls here are laid out but not wired to anything yet — each one
 * needs a flow of its own (re-authentication before an email change, a
 * confirmation step before deletion, a job to assemble an export). Shipping
 * the shell first makes the shape of that work concrete.
 *
 * Everything inert is visibly inert. A settings page whose buttons look live
 * and quietly do nothing is worse than an empty one, and "Delete account" is
 * the last place to leave that ambiguity.
 */
export default function SettingsPage() {
  const { state, hydrated, currentUser } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !currentUser) router.replace("/login?next=/settings");
  }, [hydrated, currentUser, router]);

  if (!hydrated) return <LoadingScreen label="Loading your account…" />;
  if (!currentUser) return <LoadingScreen label="Taking you to sign in…" />;

  const families = state.memberships
    .filter((m) => m.userId === currentUser.id)
    .map((m) => state.families.find((f) => f.id === m.familyId))
    .filter((f): f is NonNullable<typeof f> => !!f);

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-display text-lg font-semibold text-stone-900">
            Dynasty
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-stone-500 transition hover:text-stone-900"
          >
            Back to your trees
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
          Account settings
        </h1>

        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          <strong className="font-semibold">These controls aren&apos;t live yet.</strong>{" "}
          The page is here so you can see what&apos;s coming; nothing on it changes
          your account. To change anything today, email{" "}
          <a href="mailto:support@trydynasty.app" className="underline underline-offset-2">
            support@trydynasty.app
          </a>
          .
        </p>

        {/* ── Profile ── */}
        <Section title="Profile" note="How you appear to the rest of your family.">
          <div className="flex items-center gap-4">
            <Avatar name={currentUser.name} id={currentUser.id} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-stone-900">{currentUser.name}</p>
              <p className="truncate text-sm text-stone-500">{currentUser.email}</p>
            </div>
            <Pending>Change photo</Pending>
          </div>
          <Row label="Display name" value={currentUser.name} action="Edit" />
          <Row
            label="Email address"
            value={currentUser.email}
            hint="Changing this needs confirmation from both the old and new address."
            action="Change"
          />
        </Section>

        {/* ── Security ── */}
        <Section title="Security" note="Who can get into your account.">
          <Row
            label="Password"
            value="••••••••"
            hint="You can already reset this from the sign-in page."
            action="Change"
          />
          <Row
            label="Signed-in devices"
            value="This device"
            hint="Sign out everywhere if you've used a shared computer."
            action="Sign out everywhere"
          />
          <Row
            label="Two-factor authentication"
            value="Off"
            hint="An extra code at sign-in, in case your password leaks."
            action="Set up"
          />
        </Section>

        {/* ── Your data ── */}
        <Section
          title="Your data"
          note="Family history is meant to outlast any one app, including this one."
        >
          <Row
            label="Download your data"
            value="Everything you've added, as a file"
            hint="People, connections, photos and comments across every tree you belong to."
            action="Request"
          />
          <Row
            label="What you agreed to"
            value="Terms and Privacy Policy"
            hint="The versions you accepted, and when."
            action="View"
          />
        </Section>

        {/* ── Families ── */}
        <Section title="Your families" note="Leaving a tree doesn't delete what you added to it.">
          {families.length === 0 ? (
            <p className="py-2 text-sm text-stone-400">You&apos;re not in any families yet.</p>
          ) : (
            families.map((f) => (
              <Row key={f.id} label={f.name} value="Member" action="Leave" />
            ))
          )}
        </Section>

        {/* ── Danger zone ── */}
        <section className="mt-8 rounded-2xl border-2 border-red-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-red-900">
            Delete your account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            This closes your account and removes your profile. It does{" "}
            <strong className="font-semibold text-stone-800">not</strong> delete the
            people and connections you added to a shared tree — your relatives
            would lose that history along with you, and it isn&apos;t only yours to
            remove. Those entries stay, credited to a removed member.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            If you want a specific person or photograph taken out, remove it
            before closing the account, or ask us and we&apos;ll do it.
          </p>
          <div className="mt-4">
            <Pending danger>Delete my account</Pending>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-stone-400">
          <Link href="/legal/privacy" className="hover:text-stone-600">
            Privacy
          </Link>
          {" · "}
          <Link href="/legal/terms" className="hover:text-stone-600">
            Terms
          </Link>
        </p>
      </div>
    </main>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────────── */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-stone-200/80 bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm text-stone-500">{note}</p>
      <div className="mt-4 space-y-1">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  action: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-stone-100 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="truncate text-sm text-stone-500">{value}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-stone-400">{hint}</p>}
      </div>
      <Pending>{action}</Pending>
    </div>
  );
}

/**
 * A control that is deliberately not connected yet. Disabled rather than
 * silently inert, with the reason in the tooltip, so nobody presses it twice
 * wondering whether it worked.
 */
function Pending({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <span className="shrink-0">
      <button
        type="button"
        disabled
        title="Not available yet"
        className={`cursor-not-allowed rounded-xl border px-3 py-1.5 text-xs font-semibold opacity-60 ${
          danger
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-stone-200 bg-white text-stone-600"
        }`}
      >
        {children}
      </button>
      <span className="mt-1 block text-right text-[10px] uppercase tracking-wider text-stone-300">
        Soon
      </span>
    </span>
  );
}
