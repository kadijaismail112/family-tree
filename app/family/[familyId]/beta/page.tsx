"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { describeRelationship } from "@/lib/relationship";
import {
  buildHouseholds,
  homeHouseholdFor,
  type Household,
} from "@/lib/beta/household";
import { HouseholdView } from "@/components/beta/HouseholdView";
import { LoadingScreen, PrimaryButton } from "@/components/ui";

/**
 * Tree Beta — the tree read one household at a time.
 *
 * A tree of four thousand people cannot be drawn. Every attempt to show a
 * slice of it — a generation, a radius, a bounding box — puts an aunt by
 * marriage beside a step-parent beside a cousin and calls it a family, which
 * is how you end up with a picture nobody can read.
 *
 * So this never draws a slice. It draws a household: one couple and their
 * children, the unit people actually think in, and the only unit that stays
 * the same size no matter how large the tree gets. Everything else is a door.
 * Walking up through a parent lands you in the house they grew up in, where
 * their brothers and sisters are simply the other children. Walking down
 * through a child lands you in the house that child went on to keep.
 *
 * Read-only: it reads the same store as the main tree and writes nothing.
 */

interface Step {
  householdId: string;
  /** the person you walked through to get here */
  throughId?: string;
}

export default function TreeBetaPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();
  const { state, hydrated, currentUser, loadError, refresh } = useStore();

  const [trail, setTrail] = useState<Step[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const houses = useMemo(
    () => buildHouseholds(people, relationships),
    [people, relationships]
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const mePersonId = useMemo(
    () => people.find((p) => p.accountUserId === currentUser?.id)?.id ?? null,
    [people, currentUser?.id]
  );

  /**
   * Where to start. Your own household if you have claimed a node, and
   * otherwise the fullest house in the tree — a first screen with eight
   * children on it says more about a family than one with none.
   */
  const homeId = useMemo(() => {
    if (mePersonId) {
      const mine = homeHouseholdFor(mePersonId, houses);
      if (mine) return mine;
    }
    let best: string | null = null;
    let bestSize = -1;
    for (const house of Array.from(houses.byId.values())) {
      const size = house.headIds.length + house.childIds.length;
      if (size > bestSize) {
        bestSize = size;
        best = house.id;
      }
    }
    return best;
  }, [mePersonId, houses]);

  const currentId = trail.length ? trail[trail.length - 1].householdId : homeId;
  const house: Household | null = currentId
    ? houses.byId.get(currentId) ?? null
    : null;

  const open = useCallback((householdId: string, throughId?: string) => {
    setTrail((t) => {
      // walking back to somewhere already on the trail rewinds to it rather
      // than looping the same houses onto the end
      const seen = t.findIndex((s) => s.householdId === householdId);
      if (seen >= 0) return t.slice(0, seen + 1);
      return [...t, { householdId, throughId }];
    });
    setSelectedId(throughId ?? null);
  }, []);

  /** what each person is to you — only ever asked for the dozen on screen */
  const relationOf = useCallback(
    (personId: string) => {
      if (!mePersonId || personId === mePersonId) return undefined;
      const r = describeRelationship(personId, mePersonId, people, relationships);
      if (r.aTerm) return `your ${r.aTerm}`;
      return undefined;
    },
    [mePersonId, people, relationships]
  );

  useEffect(() => {
    if (hydrated && !currentUser) {
      router.replace(
        `/login?next=${encodeURIComponent(`/family/${familyId}/beta`)}`
      );
    }
  }, [hydrated, currentUser, familyId, router]);

  if (!hydrated) return <LoadingScreen label="Opening this tree…" />;
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

  const nameOf = (id: string) => byId.get(id)?.name.split(" ")[0] ?? "Unknown";
  const houseName = house
    ? house.headIds.map(nameOf).join(" & ")
    : family.name;
  const selected = selectedId ? byId.get(selectedId) : null;
  const selectedRelation =
    selected && mePersonId && selected.id !== mePersonId
      ? describeRelationship(selected.id, mePersonId, people, relationships)
      : null;

  return (
    <main className="flex h-screen h-[100dvh] flex-col overflow-hidden bg-stone-50">
      {/* ─── Header ─── */}
      <header className="z-20 shrink-0 border-b border-stone-200/70 bg-white">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5">
          <Link
            href={`/family/${familyId}`}
            aria-label="Back to the main tree"
            className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-base font-semibold leading-tight text-stone-900 sm:text-lg">
              {houseName}
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-widest text-amber-800">
                beta
              </span>
            </h1>
            <p className="truncate text-xs text-stone-400">
              {house
                ? `${house.childIds.length} ${
                    house.childIds.length === 1 ? "child" : "children"
                  } · ${people.length} in the whole tree`
                : family.name}
            </p>
          </div>

          {mePersonId && (
            <button
              onClick={() => {
                const mine = homeHouseholdFor(mePersonId, houses);
                if (mine) {
                  setTrail([]);
                  setSelectedId(mePersonId);
                }
              }}
              className="shrink-0 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-teal-700/40 hover:bg-teal-800/5"
            >
              My household
            </button>
          )}
        </div>

        {/* ─── how you got here ─── */}
        {trail.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
            <button
              onClick={() => {
                setTrail([]);
                setSelectedId(null);
              }}
              className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              Start
            </button>
            {trail.map((step, i) => {
              const stepHouse = houses.byId.get(step.householdId);
              const here = i === trail.length - 1;
              return (
                <div key={`${step.householdId}-${i}`} className="flex shrink-0 items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-stone-300">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <button
                    onClick={() => open(step.householdId, step.throughId)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      here
                        ? "bg-teal-800/10 text-teal-900"
                        : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    }`}
                  >
                    {stepHouse?.headIds.map(nameOf).join(" & ") ?? "Elsewhere"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </header>

      {/* ─── The household ─── */}
      <div className="flex-1 overflow-auto">
        {!house ? (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <p className="max-w-sm text-sm text-stone-400">
              No households yet. Once two people in this tree are recorded as
              parents, or as married, their household will appear here.
            </p>
          </div>
        ) : (
          <HouseholdView
            house={house}
            houses={houses}
            people={people}
            mePersonId={mePersonId}
            relationOf={relationOf}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={open}
          />
        )}
      </div>

      {/* ─── Who you tapped ─── */}
      {selected && (
        <div className="z-20 shrink-0 border-t border-stone-200 bg-white px-4 py-2.5">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-sm font-semibold text-stone-900">
                {selected.name}
              </p>
              <p className="truncate text-xs text-stone-500">
                {selectedRelation?.aTerm
                  ? `Your ${selectedRelation.aTerm}`
                  : selectedRelation
                    ? selectedRelation.label
                    : "This is you"}
              </p>
            </div>
            {(() => {
              const theirs = homeHouseholdFor(selected.id, houses);
              if (!theirs || theirs === currentId) return null;
              return (
                <button
                  onClick={() => open(theirs, selected.id)}
                  className="shrink-0 rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
                >
                  Their household
                </button>
              );
            })()}
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
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
