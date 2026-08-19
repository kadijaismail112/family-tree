import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-stone-50">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="font-display inline-flex items-center gap-2 text-lg font-semibold text-stone-900"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#115e59"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="5" r="2.4" />
            <circle cx="5.5" cy="18" r="2.4" />
            <circle cx="18.5" cy="18" r="2.4" />
            <path d="M12 7.4V12m0 0l-5 3.8M12 12l5 3.8" />
          </svg>
          Dynasty
        </Link>
      </header>

      <div className="flex flex-1 items-start justify-center px-6 pb-16">
        <div className="animate-rise w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-900/5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
            404
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold text-stone-900">
            This branch doesn&apos;t exist
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            The page you&apos;re looking for was moved, or the link was
            mistyped. Your trees are all still where you left them.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              Go to your trees
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-100"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
