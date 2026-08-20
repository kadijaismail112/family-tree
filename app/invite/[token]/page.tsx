"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { CityInput } from "@/components/CityInput";
import { inputCls, LoadingScreen, PrimaryButton, useToast } from "@/components/ui";

interface Peek {
  familyName: string;
  personName: string;
  invitedByName: string;
  expiresAt: string;
}

/**
 * The whole of an invited relative's first experience.
 *
 * Reachable signed out on purpose — someone who has never heard of Dynasty
 * should see who invited them and to what before being asked to create
 * anything. Only once they choose to accept do they get sent to sign up, and
 * the token rides along so they land back here rather than on a generic
 * dashboard wondering what happened to the invite.
 */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { hydrated, currentUser, peekPersonInvite, acceptPersonInvite } = useStore();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();

  const [peek, setPeek] = useState<Peek | null | undefined>(undefined);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    let cancelled = false;
    setLookupFailed(false);
    peekPersonInvite(token)
      .then((row) => {
        if (!cancelled) setPeek(row);
      })
      .catch(() => {
        // An unreachable server is not an invalid invite, and telling someone
        // their good link is dead is how they give up on it.
        if (!cancelled) setLookupFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [peekPersonInvite, token]);

  useEffect(load, [load, attempt]);

  if (peek === undefined && !lookupFailed) {
    return <LoadingScreen label="Checking your invitation…" />;
  }

  if (lookupFailed) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          We couldn&apos;t check that invitation
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Something went wrong reaching the server. The invitation is probably
          fine — try again in a moment.
        </p>
        <PrimaryButton className="mt-6 w-full" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </PrimaryButton>
      </Shell>
    );
  }

  if (!peek) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          This invitation has expired
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Invitations work once and only last a couple of weeks. Ask the
          relative who sent it to share a fresh link.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          About Dynasty
        </Link>
      </Shell>
    );
  }

  // Signed out: show what this is, then hand off to signup carrying the token.
  if (hydrated && !currentUser) {
    const next = encodeURIComponent(`/invite/${token}`);
    return (
      <Shell>
        <Invitation peek={peek} />
        <PrimaryButton
          className="mt-6 w-full"
          onClick={() => router.push(`/signup?next=${next}`)}
        >
          Accept invitation
        </PrimaryButton>
        <p className="mt-3 text-xs text-stone-400">
          Already have an account?{" "}
          <Link href={`/login?next=${next}`} className="text-teal-800 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </Shell>
    );
  }

  if (!hydrated) return <LoadingScreen label="Checking your invitation…" />;

  return (
    <Shell wide>
      <Invitation peek={peek} />
      <ProfileForm
        peek={peek}
        onSubmit={async (profile) => {
          const res = await acceptPersonInvite(token, profile);
          if (res.ok && res.familyId) {
            toast(`Welcome to ${peek.familyName}!`);
            router.push(`/family/${res.familyId}`);
            return null;
          }
          return res.error ?? "Couldn't accept that invitation.";
        }}
        initialCity={search.get("city") ?? ""}
      />
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-stone-50 px-6 py-12">
      <div
        className={`animate-rise w-full ${wide ? "max-w-lg" : "max-w-md"} rounded-2xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-900/5`}
      >
        {children}
      </div>
    </main>
  );
}

function Invitation({ peek }: { peek: Peek }) {
  return (
    <div className="text-center">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#115e59"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto"
      >
        <circle cx="12" cy="5" r="2.4" />
        <circle cx="5.5" cy="18" r="2.4" />
        <circle cx="18.5" cy="18" r="2.4" />
        <path d="M12 7.4V12m0 0l-5 3.8M12 12l5 3.8" />
      </svg>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-teal-800">
        {peek.invitedByName} invited you
      </p>
      <h1 className="font-display mt-2 text-2xl font-semibold leading-tight text-stone-900">
        {peek.familyName}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">
        You&apos;ve been added to this family tree as{" "}
        <strong className="font-semibold text-stone-700">{peek.personName}</strong>.
        Joining lets you fill in your own details and help build out the rest of
        the family.
      </p>
    </div>
  );
}

function ProfileForm({
  peek,
  onSubmit,
  initialCity,
}: {
  peek: Peek;
  onSubmit: (p: {
    name: string;
    birthDate?: string;
    currentCity?: string;
  }) => Promise<string | null>;
  initialCity: string;
}) {
  // Prefilled with the name already on the node — most people just confirm it,
  // and the ones recorded under a nickname or maiden name can correct it here.
  const [name, setName] = useState(peek.personName);
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState(initialCity);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="mt-6 border-t border-stone-100 pt-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving || !name.trim() || !agreed) return;
        setSaving(true);
        setError(null);
        const message = await onSubmit({
          name,
          birthDate: birthDate || undefined,
          currentCity: city || undefined,
        });
        // On success the page navigates away, so only a failure lands here.
        if (message) {
          setError(message);
          setSaving(false);
        }
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
        A little about you
      </p>

      <label className="mt-3 block">
        <span className="text-sm font-medium text-stone-700">Your name</span>
        <input
          className={`${inputCls} mt-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jordan Rivera"
          required
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-stone-700">
          Date of birth <span className="font-normal text-stone-400">· optional</span>
        </span>
        <input
          type="date"
          max={today}
          className={`${inputCls} mt-1`}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </label>

      <div className="mt-4">
        <span className="text-sm font-medium text-stone-700">
          Current city <span className="font-normal text-stone-400">· optional</span>
        </span>
        <div className="mt-1">
          <CityInput
            value={city}
            onChange={setCity}
            placeholder="Start typing a city or town…"
          />
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-teal-800 focus:ring-teal-600/30"
        />
        <span className="text-xs leading-relaxed text-stone-500">
          I agree to the{" "}
          <Link
            href="/legal/terms"
            target="_blank"
            className="text-teal-800 underline underline-offset-2"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            target="_blank"
            className="text-teal-800 underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
      )}

      <PrimaryButton
        type="submit"
        className="mt-5 w-full"
        disabled={saving || !name.trim() || !agreed}
      >
        {saving ? "Joining…" : `Join ${peek.familyName}`}
      </PrimaryButton>

      <p className="mt-3 text-center text-xs text-stone-400">
        You can add photos, stories and more once you&apos;re in.
      </p>
    </form>
  );
}
