"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { buildGraph } from "@/lib/beta/world";
import { describeRelationship } from "@/lib/relationship";
import { WorldStage } from "@/components/beta/trial1/WorldStage";
import { LoadingScreen, PrimaryButton } from "@/components/ui";

/**
 * Tree Beta · TRIAL 1 — one world at a time, swapped by a warp.
 *
 * Kept whole and reachable at /beta/trial-1 so it can be compared against
 * later trials rather than remembered. Trial 2 lives at /beta and takes the
 * opposite approach: every person keeps a fixed place on one canvas and the
 * camera travels instead of the content.
 *
 * The main tree draws the whole graph at once, which is honest and becomes a
 * hairball. This one takes the view that a family is not one shape but many
 * overlapping ones, and shows a single world at a time: grandparents down to
 * grandchildren, plus whoever married in. The people who married in are the
 * doors — step through one and you arrive in their family, with your own
 * relationship to everyone there still spelled out.
 *
 * Nothing here writes. It reads the same store as the main tree, so a wrong
 * idea tried out on this page cannot damage a real family's record.
 */

/** how far a world can be from your own before the trail is worth showing */
interface Stop {
  anchorId: string;
  /** the person you stepped through to get here */
  viaId?: string;
}

type Phase = "idle" | "leaving" | "arriving";

export default function TreeBetaPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();
  const { state, hydrated, currentUser, loadError, refresh } = useStore();

  const [trail, setTrail] = useState<Stop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

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
  const graph = useMemo(
    () => buildGraph(people, relationships),
    [people, relationships]
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const mePersonId = useMemo(
    () => people.find((p) => p.accountUserId === currentUser?.id)?.id ?? null,
    [people, currentUser?.id]
  );

  /**
   * Where you start. Your own node when you have one — the tree is about you
   * before it is about anyone else — and otherwise whoever sits in the middle
   * of the most family, so the first world is never an empty one.
   */
  const homeAnchor = useMemo(() => {
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

  const current = trail.length ? trail[trail.length - 1] : null;
  const anchorId = current?.anchorId ?? homeAnchor;

  /**
   * The warp. The world you're leaving falls away before the next one
   * arrives, so the two are never on screen together — that gap is what makes
   * it read as somewhere else rather than as a filtered list.
   */
  const travel = useCallback((toId: string, viaId?: string) => {
    setPhase("leaving");
    setSelectedId(null);
    window.setTimeout(() => {
      setTrail((t) => [...t, { anchorId: toId, viaId }]);
      setPhase("arriving");
      window.setTimeout(() => setPhase("idle"), 420);
    }, 260);
  }, []);

  const goBackTo = useCallback((index: number) => {
    setPhase("leaving");
    setSelectedId(null);
    window.setTimeout(() => {
      setTrail((t) => t.slice(0, index));
      setPhase("arriving");
      window.setTimeout(() => setPhase("idle"), 420);
    }, 260);
  }, []);

  useEffect(() => {
    if (hydrated && !currentUser) {
      router.replace(
        `/login?next=${encodeURIComponent(`/family/${familyId}/beta/trial-1`)}`
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

  const anchor = anchorId ? byId.get(anchorId) : null;
  const selected = selectedId ? byId.get(selectedId) : null;
  const selectedRelation =
    selected && mePersonId && selected.id !== mePersonId
      ? describeRelationship(selected.id, mePersonId, people, relationships)
      : null;

  const worldName = anchor
    ? `${anchor.name.split(" ").slice(-1)[0]}'s world`
    : family.name;

  return (
    <main className="relative flex h-screen h-[100dvh] flex-col overflow-hidden bg-[#0b1020]">
      {/* the space this all sits in */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(45,212,191,0.14),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(129,80,255,0.16),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.5)_0.6px,transparent_0.7px)] [background-size:44px_44px] opacity-[0.13]" />
      </div>

      {/* ─── Header ─── */}
      <header className="relative z-20 border-b border-white/10 bg-white/5 backdrop-blur-md">
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
              {worldName}
              <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/40">
                beta
              </span>
            </h1>
            <p className="truncate text-xs text-indigo-200/40">
              {family.name} · {people.length}{" "}
              {people.length === 1 ? "person" : "people"} in the whole tree
            </p>
          </div>

          <div className="relative hidden w-52 md:block">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dim everyone but…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-3 pr-3 text-sm text-white outline-none transition placeholder:text-indigo-200/30 focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/20"
            />
          </div>

          <div className="flex shrink-0 items-center rounded-xl bg-white/10 p-0.5">
            <span className="rounded-[10px] bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white">
              Trial 1
            </span>
            <Link
              href={`/family/${familyId}/beta`}
              className="rounded-[10px] px-2.5 py-1.5 text-[11px] font-semibold text-indigo-200/60 transition hover:text-white"
            >
              Trial 2
            </Link>
          </div>

          <Link
            href={`/family/${familyId}`}
            className="hidden shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-white/15 sm:block"
          >
            Main tree
          </Link>
        </div>

        {/* ─── The trail you travelled ─── */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2.5 sm:px-5">
          <button
            onClick={() => goBackTo(0)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              trail.length === 0
                ? "bg-teal-400/20 text-teal-200 ring-1 ring-teal-400/40"
                : "text-indigo-200/50 hover:bg-white/10 hover:text-white"
            }`}
          >
            {mePersonId ? "Your family" : "Home"}
          </button>
          {trail.map((stop, i) => {
            const via = stop.viaId ? byId.get(stop.viaId) : null;
            const here = i === trail.length - 1;
            return (
              <div key={`${stop.anchorId}-${i}`} className="flex shrink-0 items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-indigo-300/25">
                  <path d="m9 18 6-6-6-6" />
                </svg>
                <button
                  onClick={() => goBackTo(i + 1)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    here
                      ? "bg-teal-400/20 text-teal-200 ring-1 ring-teal-400/40"
                      : "text-indigo-200/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {via?.name.split(" ")[0] ??
                    byId.get(stop.anchorId)?.name.split(" ")[0] ??
                    "Elsewhere"}
                </button>
              </div>
            );
          })}
        </div>
      </header>

      {/* ─── The world ─── */}
      <div className="relative z-10 flex-1 overflow-auto">
        {!anchorId ? (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <p className="max-w-sm text-sm text-indigo-200/50">
              Nobody is in this tree yet. Add a few people on the main tree and
              their worlds will appear here.
            </p>
          </div>
        ) : (
          <div
            key={anchorId}
            className={`min-h-full transition-all duration-300 ease-out ${
              phase === "leaving"
                ? "scale-[0.82] opacity-0 blur-sm"
                : phase === "arriving"
                  ? "animate-[worldArrive_420ms_ease-out]"
                  : "scale-100 opacity-100 blur-0"
            }`}
          >
            <WorldStage
              anchorId={anchorId}
              people={people}
              relationships={relationships}
              graph={graph}
              mePersonId={mePersonId}
              selectedId={selectedId}
              search={search}
              onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
              onEnter={(id) => travel(id, id)}
            />
          </div>
        )}
      </div>

      {/* ─── Who you just tapped ─── */}
      {selected && (
        <div className="relative z-20 border-t border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
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
                {selectedRelation?.via ? ` · ${selectedRelation.via}` : ""}
              </p>
            </div>
            {anchorId !== selected.id && (
              <button
                onClick={() => travel(selected.id, selected.id)}
                className="shrink-0 rounded-xl bg-teal-400/20 px-3 py-2 text-xs font-semibold text-teal-100 ring-1 ring-teal-400/40 transition hover:bg-teal-400/30"
              >
                Centre on them
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
