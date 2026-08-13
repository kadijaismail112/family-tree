"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-stone-900">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">
        {error.message || "The page hit an unexpected error."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
      >
        Try again
      </button>
    </main>
  );
}
