"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { DevBypassButton } from "@/components/DevBypassButton";
import { Field, inputCls, PrimaryButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

// Why the email link didn't work, in terms of what to do about it.
const AUTH_ERRORS: Record<string, string> = {
  link: "That link was missing its sign-in code — some mail apps cut long links short. Sign in here instead, or request a new email.",
  expired:
    "That link has expired or was already used. Sign in below, or request a new one.",
};

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const raw = search.get("next");
  const next = raw && raw.startsWith("/") ? raw : "/dashboard";
  const authError = search.get("error");
  const invited = next.startsWith("/join/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    authError ? AUTH_ERRORS[authError] ?? AUTH_ERRORS.expired : null
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        invited
          ? "Sign in to accept your invite — we'll take you straight back to it."
          : "Sign in to the family trees you belong to."
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <Field label="Email">
          <input
            autoFocus
            type="email"
            autoComplete="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
        )}
        <PrimaryButton type="submit" disabled={busy || !email || !password} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </PrimaryButton>
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-stone-500 hover:text-stone-800">
            Forgot password?
          </Link>
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="font-medium text-teal-800 hover:underline"
          >
            Create an account
          </Link>
        </div>
      </form>
      <DevBypassButton next={next} />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <LoginForm />
    </Suspense>
  );
}
