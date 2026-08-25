"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { describeRelationship } from "@/lib/relationship";
import { buildGraph } from "@/lib/beta/world";
import type { Galaxy } from "@/lib/beta/galaxy";
import { GalaxyCanvas } from "@/components/beta/trial2/GalaxyCanvas";
import { LoadingScreen, PrimaryButton } from "@/components/ui";

/**
 * Tree Beta · TRIAL 2 — one canvas, a moving camera.
 *
 * Trial 1 is still at /beta/trial-1. It gave each family the whole screen and
 * warped between them, which read beautifully and quietly implied the families
 * were separate things. This is the other answer to the same question: put
 * everyone in one space for good, and move the eye instead of the contents.
 *
 * Focus is depth, not deletion. The family you are reading sits on the focal
 * plane, sharp and named; everyone else is still there, still joined to them,
 * just further off. Rising a generation lifts the camera rather than loading a
 * new view, so the ground you were standing on stays in sight below you.
 *
 * Read-only, like Trial 1.
 */

export default function TreeBetaTrial2Page() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();
  const { state, hydrated, currentUser, loadError, refresh } = useStore();

  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [genCursor, setGenCursor] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);

  const family = state.families.find((f) => f.id === familyId);
  const isMember =
    !!currentUser &&
    state.memberships.some(
      (m) => m.familyId === familyId && m.userId === currentUser.id
    );

  const people = useMemo(
    () => state.people.filter((p) => p.familyId === familyId),
    [state.people, familyId]
  );
  const relationships = useMemo(
    () => state.relationships.filter((r) => r.familyId === familyId),
    [state.relationships, familyId]
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const graph = useMemo(
    () => buildGraph(people, relationships),
    [people, relationships]
  );

  const mePersonId = useMemo(
    () => people.find((p) => p.accountUserId === currentUser?.id)?.id ?? null,
    [people, currentUser?.id]
  );

  const homeId = useMemo(() => {
    if (mePersonId) return mePersonId;
    if (!people.length) return null;
    let best = people[0].id;
    let bestScore = -1;
    for (const p of people) {
      const score =
        (graph.parents.get(p.id)?.length ?? 0) +
        (graph.children.get(p.id)?.length ?? 0) * 2 +
        (graph.spouses.get(p.id)?.length ?? 0);
      if (score > bestScore) {
        bestScore = score;
        best = p.id;
      }
    }
    return best;
  }, [mePersonId, people, graph]);

  const activeAnchor = anchorId ?? homeId;

  // the cursor follows whoever you fly to, until you start stepping it yourself
  const anchorGen = activeAnchor
    ? galaxy?.nodes.get(activeAnchor)?.generation ?? 0
    : 0;
  const cursor = genCursor ?? anchorGen;

  /** fly to someone: their island, their generation */
  const flyTo = useCallback((personId: string) => {
    setAnchorId(personId);
    setGenCursor(null);
    setSelectedId(personId);
  }, []);

  useEffect(() => {
    if (hydrated && !currentUser) {
      router.replace(
        `/login?next=${encodeURIComponent(`/family/${familyId}/beta`)}`
      );
    }
  }, [hydrated, currentUser, familyId, router]);

  if (!hydrated) return <LoadingScreen label="Charting the family…" />;
  if (!currentUser) return <LoadingScreen label="Taking you to sign in…" />;

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          Couldn&apos;t load this tree
        </h1>
        <p className="max-w-sm text-stone-500">{loadError}</p>
        <PrimaryButton onClick={() => void refresh()}>Try again</PrimaryButton>
      </main>
    );
  }

  if (!family || !isMember) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          {family ? "This tree is private" : "Family not found"}
        </h1>
        <Link
          href="/dashboard"
          className="mt-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          Back to your families
        </Link>
      </main>
    );
  }

  const anchor = activeAnchor ? byId.get(activeAnchor) : null;
  const selected = selectedId ? byId.get(selectedId) : null;
  const selectedRelation =
    selected && mePersonId && selected.id !== mePersonId
      ? describeRelationship(selected.id, mePersonId, people, relationships)
      : null;

  // who the selected person could take you to — their partners are the way
  // into families this one does not contain
  const doorsFrom = selected
    ? (graph.spouses.get(selected.id) ?? []).filter((id) => id !== activeAnchor)
    : [];

  const canRise = !!galaxy && cursor > galaxy.minGeneration;
  const canDescend = !!galaxy && cursor < galaxy.maxGeneration;
  const drift = cursor - anchorGen;

  return (
    <main className="relative flex h-screen h-[100dvh] flex-col overflow-hidden bg-[#080d1c]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(45,212,191,0.12),transparent_50%),radial-gradient(circle_at_78%_72%,rgba(129,80,255,0.14),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.55)_0.6px,transparent_0.7px)] [background-size:52px_52px] opacity-[0.1]" />
      </div>

      {/* ─── Header ─── */}
      <header className="relative z-30 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5">
          <Link
            href={`/family/${familyId}`}
            aria-label="Back to the main tree"
            className="shrink-0 rounded-lg p-1.5 text-indigo-200/60 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-base font-semibold leading-tight text-white sm:text-lg">
              {anchor ? `Around ${anchor.name.split(" ")[0]}` : family.name}
              <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/40">
                trial 2
              </span>
            </h1>
            <p className="truncate text-xs text-indigo-200/40">
              {family.name} · {people.length}{" "}
              {people.length === 1 ? "person" : "people"} on one canvas
            </p>
          </div>

          <div className="flex shrink-0 items-center rounded-xl bg-white/10 p-0.5">
            <Link
              href={`/family/${familyId}/beta/trial-1`}
              className="rounded-[10px] px-2.5 py-1.5 text-[11px] font-semibold text-indigo-200/60 transition hover:text-white"
            >
              Trial 1
            </Link>
            <span className="rounded-[10px] bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white">
              Trial 2
            </span>
          </div>

          {mePersonId && (
            <button
              onClick={() => flyTo(mePersonId)}
              className="hidden shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/15 sm:block"
            >
              Find me
            </button>
          )}
        </div>
      </header>

      {/* ─── The canvas ─── */}
      <div className="relative z-10 flex-1">
        {!activeAnchor ? (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <p className="max-w-sm text-sm text-indigo-200/50">
              Nobody is in this tree yet. Add a few people on the main tree and
              they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <GalaxyCanvas
            people={people}
            relationships={relationships}
            mePersonId={mePersonId}
            anchorId={activeAnchor}
            generationCursor={cursor}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAnchor={flyTo}
            onGalaxy={setGalaxy}
          />
        )}
      </div>

      {/* ─── Rising and falling through the generations ─── */}
      <div className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2">
        <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md">
          <button
            onClick={() => setGenCursor(cursor - 1)}
            disabled={!canRise}
            aria-label="Up a generation"
            className="rounded-xl px-2.5 py-2 text-indigo-100 transition hover:bg-white/15 disabled:opacity-25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          <span className="px-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-indigo-200/50">
            {drift === 0
              ? "here"
              : drift < 0
                ? `${-drift} up`
                : `${drift} down`}
          </span>
          <button
            onClick={() => setGenCursor(cursor + 1)}
            disabled={!canDescend}
            aria-label="Down a generation"
            className="rounded-xl px-2.5 py-2 text-indigo-100 transition hover:bg-white/15 disabled:opacity-25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {drift !== 0 && (
            <button
              onClick={() => setGenCursor(null)}
              className="mt-0.5 rounded-lg px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-teal-300 transition hover:bg-white/15"
            >
              back
            </button>
          )}
        </div>
      </div>

      {/* ─── Who you tapped, and where they can take you ─── */}
      {selected && (
        <div className="relative z-30 border-t border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-sm font-semibold text-white">
                {selected.name}
              </p>
              <p className="truncate text-xs text-indigo-200/50">
                {selectedRelation?.aTerm
                  ? `Your ${selectedRelation.aTerm}`
                  : selectedRelation
                    ? selectedRelation.label
                    : "This is you"}
              </p>
            </div>

            {/* the spouses are the way through to another family */}
            {doorsFrom.map((spouseId) => {
              const spouse = byId.get(spouseId);
              if (!spouse) return null;
              return (
                <button
                  key={spouseId}
                  onClick={() => flyTo(spouseId)}
                  className="shrink-0 rounded-xl bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/40 transition hover:bg-amber-400/30"
                >
                  Into {spouse.name.split(" ")[0]}&apos;s family →
                </button>
              );
            })}

            {activeAnchor !== selected.id && (
              <button
                onClick={() => flyTo(selected.id)}
                className="shrink-0 rounded-xl bg-teal-400/20 px-3 py-2 text-xs font-semibold text-teal-100 ring-1 ring-teal-400/40 transition hover:bg-teal-400/30"
              >
                Fly here
              </button>
            )}
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="shrink-0 rounded-lg p-2 text-indigo-200/50 transition hover:bg-white/10 hover:text-white"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
