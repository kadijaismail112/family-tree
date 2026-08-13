"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { colorFor, initials } from "@/lib/helpers";

/* ─── Modal ─────────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-[2px] p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl ring-1 ring-stone-900/5 sm:rounded-2xl animate-rise`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Form primitives ───────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-stone-700">
        {label}
        {hint && <span className="text-xs font-normal text-stone-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Avatar ────────────────────────────────────────────────────────── */

export function Avatar({
  name,
  id,
  size = 32,
  className = "",
  src,
}: {
  name: string;
  id: string;
  size?: number;
  className?: string;
  /** a real portrait, when one has been added */
  src?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFor(id),
        fontSize: size * 0.38,
      }}
    >
      {initials(name)}
    </span>
  );
}

/* ─── Two-step destructive button ───────────────────────────────────── */

export function DangerButton({
  label,
  confirmLabel,
  onConfirm,
  className = "",
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
        armed
          ? "bg-red-600 text-white hover:bg-red-500"
          : "text-red-600 hover:bg-red-50"
      } ${className}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/* ─── Loading ───────────────────────────────────────────────────────── */

/**
 * Signing in and loading a tree are two round trips, and on a slow connection
 * a bare background is indistinguishable from a broken page.
 */
export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-50">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-teal-800"
        aria-hidden
      />
      <p className="text-sm text-stone-500">{label}</p>
    </main>
  );
}

/* ─── Toasts ────────────────────────────────────────────────────────── */

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
}

const ToastContext = createContext<(message: string, kind?: Toast["kind"]) => void>(
  () => {}
);

export function useToast() {
  return useContext(ToastContext);
}

/**
 * Every mutation is a round trip now, so each button that triggers one needs
 * the same three things: no double-submit, a success message only once the
 * write has actually landed, and the real reason on screen when it hasn't.
 * Doing that by hand at each call site is how you end up with "Saved" toasts
 * over failed saves.
 *
 * An action may report failure by throwing or by resolving to
 * `{ ok: false, error }`; both are surfaced the same way.
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  // A ref as well as state: two clicks in one tick would both see `pending`
  // as false, which is exactly the double-submit we are trying to prevent.
  const inFlight = useRef(false);

  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      messages?: { success?: string; failure?: string }
    ): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setPending(true);
      try {
        const result = await action();
        if (
          result &&
          typeof result === "object" &&
          "ok" in result &&
          (result as { ok: boolean }).ok === false
        ) {
          const { error } = result as { error?: string };
          toast(error ?? messages?.failure ?? "That didn't work.", "error");
          return false;
        }
        if (messages?.success) toast(messages.success);
        return true;
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : (messages?.failure ?? "That didn't work.");
        toast(message, "error");
        return false;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [toast]
  );

  return { run, pending };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise pointer-events-auto flex items-center gap-2.5 rounded-full py-2 pl-3 pr-4 text-sm font-medium shadow-lg ring-1 ${
              t.kind === "error"
                ? "bg-red-600 text-white ring-red-700/50"
                : t.kind === "info"
                  ? "bg-stone-800 text-white ring-stone-900/50"
                  : "bg-teal-800 text-white ring-teal-900/50"
            }`}
          >
            {t.kind === "success" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
