"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { DevBypassButton } from "@/components/DevBypassButton";
import { Field, inputCls, PrimaryButton } from "@/components/ui";
import { Turnstile } from "@/components/Turnstile";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  // Most people meet this app through an invite link, and the invite has to
  // survive the detour through account creation — otherwise they finish
  // signing up and land on an empty dashboard with no way back to the family.
  const raw = search.get("next");
  const next = raw && raw.startsWith("/") ? raw : "/dashboard";
  const invited = next.startsWith("/invite/");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [captcha, setCaptcha] = useState<string | undefined>();
  const [captchaKey, setCaptchaKey] = useState(0);

  const submit = async () => {
    // The button is disabled without this, but a form can still be submitted
    // by pressing Enter in a field, so the guard has to live here too.
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { display_name: name.trim() },
        captchaToken: captcha,
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      // The token is spent either way, so a retry needs a fresh one.
      setCaptchaKey((k) => k + 1);
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    // The link in that email signs them in and drops them where they were
    // headed, so there is no second trip through this form.
    setInfo(
      invited
        ? "Check your email for a confirmation link. Opening it will bring you straight back to the invite."
        : "Check your email for a confirmation link. Opening it finishes setting up your account."
    );
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        invited
          ? "Once your account is ready we'll take you back to the invite."
          : "You'll be able to start a family tree, or join one with an invite code."
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <Field label="Your name">
          <input
            autoFocus
            className={inputCls}
            placeholder="e.g. Jordan Rivera"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" hint="At least 6 characters.">
          <input
            type="password"
            autoComplete="new-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {/* Consent is its own step rather than fine print under the button:
            these trees hold other people's information, so the terms are
            something to read, not something to have implicitly agreed to. */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 px-3.5 py-3 transition hover:border-stone-300">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-800"
          />
          <span className="text-[13px] leading-relaxed text-stone-600">
            I have read and agree to the{" "}
            <Link
              href="/legal/terms"
              target="_blank"
              className="font-medium text-teal-800 underline decoration-teal-700/30 underline-offset-2"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              target="_blank"
              className="font-medium text-teal-800 underline decoration-teal-700/30 underline-offset-2"
            >
              Privacy Policy
            </Link>
            , including my responsibility for information I record about my
            relatives.
          </span>
        </label>
        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
        )}
        {info && (
          <p className="rounded-xl bg-teal-800/5 px-3.5 py-2.5 text-sm text-teal-900">{info}</p>
        )}
        <Turnstile onToken={setCaptcha} resetKey={captchaKey} />
        <PrimaryButton
          type="submit"
          disabled={busy || !name.trim() || !email || password.length < 6 || !accepted}
          className="w-full"
        >
          {busy ? "Creating account…" : "Create account"}
        </PrimaryButton>
        <p className="text-center text-sm text-stone-500">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-teal-800 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
      <DevBypassButton next={next} />
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <SignupForm />
    </Suspense>
  );
}
