"use client";

import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Field, inputCls, PrimaryButton } from "@/components/ui";
import { Turnstile } from "@/components/Turnstile";
import { createClient } from "@/lib/supabase/client";
import { emailReturnUrl } from "@/lib/siteOrigin";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | undefined>();
  const [captchaKey, setCaptchaKey] = useState(0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: emailReturnUrl("/auth/callback?next=/auth/update-password"),
      captchaToken: captcha,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      setCaptchaKey((k) => k + 1);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
    >
      {sent ? (
        <p className="rounded-xl bg-teal-800/5 px-3.5 py-2.5 text-sm text-teal-900">
          If an account exists for {email}, a reset link is on its way.
        </p>
      ) : (
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
          {error && (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
          )}
          <Turnstile onToken={setCaptcha} resetKey={captchaKey} />
          <PrimaryButton type="submit" disabled={busy || !email} className="w-full">
            {busy ? "Sending…" : "Send reset link"}
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
