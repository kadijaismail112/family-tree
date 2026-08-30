"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";
import { reasonFor } from "@/lib/authLink";
import { LoadingScreen } from "@/components/ui";

/**
 * The last step of an emailed link, done in the browser because it has to be.
 *
 * Supabase sends this project's confirmation links back with everything in the
 * URL *fragment*:
 *
 *   /auth/callback?next=%2Finvite%2Fabc#access_token=…&refresh_token=…
 *
 * A fragment is never sent to a server. /auth/callback is a route handler, so
 * all it could ever see was `?next=` — no code, no token, no error — and it
 * reported the link as missing its sign-in code. The link was fine every time;
 * the half that mattered was in the one part of the URL the server cannot
 * read. That is why confirmations never completed and everyone ended up stuck
 * on "Email not confirmed".
 *
 * Browsers keep the fragment across a redirect, so the route hands over to
 * this page, which can actually see it.
 */
function Finish() {
  const router = useRouter();
  // Strict Mode mounts effects twice in development, and a refresh token may
  // only be redeemed once — a second run would fail and bounce a perfectly
  // good sign-in to the error page.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const url = new URL(window.location.href);
    const next = safeNext(url.searchParams.get("next"));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    // Take the tokens out of the address bar before anything else: they are
    // credentials, and they should not survive in history or get copied out
    // of the URL bar by someone sharing "the page that worked".
    const clean = () =>
      window.history.replaceState(null, "", url.pathname + url.search);

    const fail = (reason: string) => {
      clean();
      router.replace(`/login?error=${reason}&next=${encodeURIComponent(next)}`);
    };

    // Supabase reports refusals in the fragment too, which is how "this link
    // was already used" reached the server looking like an empty query string.
    const error = hash.get("error");
    const errorCode = hash.get("error_code");
    if (error || errorCode) {
      fail(reasonFor(errorCode, error));
      return;
    }

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) {
      fail("link");
      return;
    }

    void (async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (err) {
        fail("expired");
        return;
      }
      clean();
      router.replace(next);
      router.refresh();
    })();
  }, [router]);

  return <LoadingScreen label="Finishing sign-in…" />;
}

export default function AuthFinishPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Finishing sign-in…" />}>
      <Finish />
    </Suspense>
  );
}
