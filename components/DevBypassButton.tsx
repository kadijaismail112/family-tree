"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DevBypassButton({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (process.env.NODE_ENV !== "development") return null;

  const skip = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/login", { method: "POST" });
      const body = (await res.json()) as {
        email?: string;
        password?: string;
        error?: string;
      };
      if (!res.ok || !body.email || !body.password) {
        throw new Error(body.error ?? "Dev login failed");
      }
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (signError) throw signError;
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed");
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-dashed border-stone-200 pt-5">
      <button
        type="button"
        onClick={() => void skip()}
        disabled={busy}
        className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Dev mode — skip login"}
      </button>
      <p className="mt-2 text-center text-[11px] text-stone-400">
        Development only. Signs you in as a local test account.
      </p>
      {error && (
        <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
