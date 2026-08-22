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

const MODAL_WIDTHS = {
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const;

/**
 * The card is a flex column with its own scrolling body, not one long
 * scrolling block: a title that scrolls away the moment the content is
 * taller than the screen leaves you reading a half-cropped heading with no
 * visible close button.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: keyof typeof MODAL_WIDTHS;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // A modal over a scrollable page that still scrolls the page behind it
  // reads as broken on a phone.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const [vvh, setVvh] = useState<number | null>(null);
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const apply = () => setVvh(vv.height);
    apply();
    vv.addEventListener("resize", apply);
    return () => vv.removeEventListener("resize", apply);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-[2px] p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex w-full ${MODAL_WIDTHS[size]} max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-stone-900/5 sm:max-h-[86dvh] sm:rounded-2xl animate-rise`}
        style={vvh ? { maxHeight: vvh } : undefined}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-stone-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
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

/**
 * A row of buttons instead of a `<select>` for the short, closed choices.
 * In a 340px panel a native select hides its options behind a tap and reads
 * as "unknown" and "living" being the same kind of thing as a free-text
 * field; laid out as a row, the choice and the current answer are one glance.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  hint,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
  hint?: string;
}) {
  return (
    <div>
      {label && (
        <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-stone-700">
          {label}
          {hint && <span className="text-xs font-normal text-stone-400">{hint}</span>}
        </span>
      )}
      <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 truncate rounded-lg px-2 py-1.5 text-[13px] font-medium transition ${
              value === o.value
                ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-900/5"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A titled section that folds away. Long-lived reference lists (connections,
 * history) are worth keeping on the page but not worth the whole panel, so
 * they collapse to a single line that still says what's inside.
 */
export function Collapsible({
  title,
  count,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  /** one line shown while collapsed, so folding it away loses nothing */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-stone-200/80">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-stone-50"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone-500">
          {title}
          {count !== undefined && ` · ${count}`}
        </span>
        {!open && summary && (
          <span className="ml-auto min-w-0 truncate text-xs text-stone-400">{summary}</span>
        )}
      </button>
      {open && <div className="border-t border-stone-100 px-3 py-2.5">{children}</div>}
    </div>
  );
}

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
  addedBy,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  /**
   * Who contributed the thing being deleted, when it wasn't the person doing
   * the deleting. Anyone in a family can remove anything, and deletion is
   * permanent and cascades — so removing someone else's work asks for a
   * deliberate second step rather than the tap-twice arming below.
   */
  addedBy?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed || addedBy) return; // the panel waits; the bare button times out
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed, addedBy]);

  if (addedBy && armed) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3">
        <p className="text-[13px] font-semibold text-red-900">
          {confirmLabel}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-red-800">
          <span className="font-medium">{addedBy}</span> added this, not you.
          Removing it is permanent and can&apos;t be undone.
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => setArmed(false)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Keep it
          </button>
          <button
            onClick={() => {
              setArmed(false);
              onConfirm();
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
          >
            Remove anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => (armed && !addedBy ? onConfirm() : setArmed(true))}
      className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
        armed
          ? "bg-red-600 text-white hover:bg-red-500"
          : "text-red-600 hover:bg-red-50"
      } ${className}`}
    >
      {armed && !addedBy ? confirmLabel : label}
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

/* ─── Wordmark ──────────────────────────────────────────────────────── */

/**
 * The Dynasty lockup: glyph plus name.
 *
 * It exists because the two were being written out by hand at each site, and
 * the dashboard and auth pages ended up with the name and no mark — the brand
 * quietly disappearing on exactly the screens a signed-in person looks at most.
 */
export function Wordmark({
  muted = false,
  className = "",
}: {
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`font-display inline-flex items-center gap-2 text-lg font-semibold ${
        muted ? "text-stone-400" : "text-stone-900"
      } ${className}`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={muted ? "#a8a29e" : "#115e59"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="12" cy="5" r="2.4" />
        <circle cx="5.5" cy="18" r="2.4" />
        <circle cx="18.5" cy="18" r="2.4" />
        <path d="M12 7.4V12m0 0l-5 3.8M12 12l5 3.8" />
      </svg>
      Dynasty
    </span>
  );
}
