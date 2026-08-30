"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Field, inputCls, PrimaryButton } from "@/components/ui";
import { Turnstile } from "@/components/Turnstile";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";
import { emailReturnUrl } from "@/lib/siteOrigin";

/**
 * Why the emailed link didn't work, in terms of what to do about it. Each of
 * these can be answered from this page, which is the point — the previous
 * copy told people to "request a new email" without anywhere to request one.
 */
const AUTH_ERRORS: Record<string, string> = {
  expired:
    "That confirmation link has already been used or has expired. Mail scanners sometimes open links before you do, which uses them up. Send yourself a fresh one below.",
  link: "That link arrived without its confirmation code — some mail apps shorten long links. Send yourself a fresh one below, or sign in if your account is already confirmed.",
  failed:
    "That confirmation link couldn't be checked. Send yourself a fresh one below.",
};

/** Supabase's wording, replaced with something a person can act on. */
function readable(message: string) {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed")) {
    return "This account still needs its email confirmed. Send yourself a new confirmation link below — it only takes a moment.";
  }
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account. Check them, or create an account if you haven't yet.";
  }
  return message;
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const authError = search.get("error");
  const invited = next.startsWith("/invite/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    authError ? AUTH_ERRORS[authError] ?? AUTH_ERRORS.failed : null
  );
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | undefined>();
  const [captchaKey, setCaptchaKey] = useState(0);

  /**
   * Whether to offer a fresh confirmation email. Shown whenever a link
   * brought them here, and whenever a sign-in fails for the one reason a new
   * link would fix.
   */
  const [offerResend, setOfferResend] = useState(!!authError);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  /**
   * An implicit-flow link carries its tokens in the URL fragment, which never
   * reaches the server, so /auth/callback cannot act on one. The browser does
   * keep the fragment across that redirect, so it arrives here — and this
   * turns it into a session rather than letting a perfectly good link die on
   * a page telling its owner it was broken.
   */
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;
    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (cancelled) return;
      // clear the tokens out of the address bar either way
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!err) {
        router.replace(next);
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResent(false);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captcha },
    });
    setBusy(false);
    if (err) {
      setError(readable(err.message));
      // Only one sign-in failure is fixed by a new email; offering it for a
      // wrong password would just send people round a loop that cannot help.
      if (err.message.toLowerCase().includes("email not confirmed")) {
        setOfferResend(true);
      }
      // The token is spent either way, so a retry needs a fresh one.
      setCaptchaKey((k) => k + 1);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const resend = async () => {
    if (!email) {
      setError("Enter your email address first, then send the link.");
      return;
    }
    setResending(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        // straight back to wherever they were headed, invite included
        emailRedirectTo: emailReturnUrl(
          `/auth/callback?next=${encodeURIComponent(next)}`
        ),
        captchaToken: captcha,
      },
    });
    setResending(false);
    setCaptchaKey((k) => k + 1);
    if (err) {
      setError(readable(err.message));
      return;
    }
    setResent(true);
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
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm leading-relaxed text-red-700">
            {error}
          </p>
        )}

        {resent ? (
          <p className="rounded-xl bg-teal-800/5 px-3.5 py-2.5 text-sm leading-relaxed text-teal-900">
            A new confirmation link is on its way to {email}. Open it on this
            phone or computer if you can — that keeps you signed in here.
            {invited && " It will bring you back to the invitation."}
          </p>
        ) : (
          offerResend && (
            <button
              type="button"
              onClick={() => void resend()}
              disabled={resending}
              className="w-full rounded-xl border border-teal-700/30 bg-white px-3.5 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-800/5 disabled:opacity-50"
            >
              {resending ? "Sending…" : "Send me a new confirmation link"}
            </button>
          )
        )}

        <Turnstile onToken={setCaptcha} resetKey={captchaKey} />
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
        {!offerResend && (
          <p className="text-center text-[12px] text-stone-400">
            Never got the confirmation email?{" "}
            <button
              type="button"
              onClick={() => setOfferResend(true)}
              className="font-medium text-teal-700 hover:underline"
            >
              Send it again
            </button>
          </p>
        )}
      </form>
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
