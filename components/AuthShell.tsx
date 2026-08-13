import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-stone-50">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-lg font-semibold text-stone-900">
          Rootline
        </Link>
      </header>
      <div className="flex flex-1 items-start justify-center px-6 pb-16">
        <div className="animate-rise w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-900/5">
          <h1 className="font-display text-2xl font-semibold text-stone-900">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
