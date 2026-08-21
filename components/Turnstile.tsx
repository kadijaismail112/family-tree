"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, wired for Supabase's CAPTCHA protection.
 *
 * Renders nothing at all unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so this
 * can ship long before the feature is switched on: with no key there is no
 * widget, no script request, and `onToken` reports undefined, which is exactly
 * what the auth calls send today.
 *
 * Order matters when enabling it. Supabase starts rejecting every auth request
 * without a token the moment CAPTCHA is turned on in the dashboard, so the key
 * must be live in the deployment *before* the dashboard switch is flipped.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const TURNSTILE_ENABLED = !!SITE_KEY;

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      appearance?: "always" | "execute" | "interaction-only";
    }
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null; // let a later mount retry rather than cache failure
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({
  onToken,
  resetKey = 0,
}: {
  /** Called with the token, or undefined when it expires or errors. */
  onToken: (token: string | undefined) => void;
  /**
   * Bump this after a failed submit. Turnstile tokens are single use, so a
   * second attempt with the same token is rejected — without a reset, one
   * wrong password locks someone out of retrying.
   */
  resetKey?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Kept in a ref so re-renders don't tear down and rebuild the widget.
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY || !holder.current) return;
    let cancelled = false;
    const el = holder.current;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          callback: (token) => cb.current(token),
          "error-callback": () => cb.current(undefined),
          "expired-callback": () => cb.current(undefined),
          theme: "light",
        });
      })
      .catch(() => {
        // Reaching Cloudflare is not something the visitor can fix, and a
        // dead widget should not silently look like a solved one.
        cb.current(undefined);
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!resetKey || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
    cb.current(undefined);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={holder} className="mt-4 flex justify-center" />;
}
