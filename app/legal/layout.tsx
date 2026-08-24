import Link from "next/link";
import { Wordmark } from "@/components/ui";

/** Shared shell for the policy pages, so they read as part of the product. */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-stone-50">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-6 py-6">
        <Link href="/" aria-label="Dynasty home">
          <Wordmark />
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-stone-500 transition hover:text-stone-900"
        >
          Back
        </Link>
      </header>

      <article className="legal mx-auto max-w-2xl px-6 pb-24">{children}</article>

      <footer className="mx-auto flex max-w-2xl flex-wrap gap-x-5 gap-y-2 border-t border-stone-200 px-6 py-8 text-sm text-stone-400">
        <Link href="/legal/privacy" className="transition hover:text-stone-700">
          Privacy
        </Link>
        <Link href="/legal/terms" className="transition hover:text-stone-700">
          Terms
        </Link>
        <span className="ml-auto">Your tree is private to your family.</span>
      </footer>
    </main>
  );
}
