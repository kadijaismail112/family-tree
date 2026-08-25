"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { findPath, personMatch, personMatches, timeAgo } from "@/lib/helpers";
import { useNarrow } from "@/lib/useNarrow";
import { allSuggestions } from "@/lib/suggestions";
import { CLUSTER_OPTIONS, type ClusterKey } from "@/lib/cluster";
import {
  TreeCanvas,
  type PathHighlight,
  type Selection,
  type ViewMode,
} from "@/components/TreeCanvas";
import { DetailPanel } from "@/components/DetailPanel";
import { AddMemberModal } from "@/components/AddMemberModal";
import { AddChildrenModal } from "@/components/AddChildrenModal";
import { ConnectModal } from "@/components/ConnectModal";
import { InvitePersonModal } from "@/components/InvitePersonModal";
import { ReviewModal } from "@/components/ReviewModal";
import dynamic from "next/dynamic";
import { RelationshipModal } from "@/components/RelationshipModal";
import {
  Avatar,
  DangerButton,
  GhostButton,
  LoadingScreen,
  Modal,
  PrimaryButton,
  useAction,
  useToast,
} from "@/components/ui";

/**
 * The map view drags in d3-geo and the world-atlas land shapes. Statically
 * imported, every visit to a family paid for that chunk before the tree could
 * paint — including the visits that never leave the Tree tab.
 */
const GlobeView = dynamic(
  () => import("@/components/GlobeView").then((m) => m.GlobeView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-stone-50">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-teal-800"
          aria-hidden
        />
      </div>
    ),
  }
);

const VIEWS = [
  { key: "tree", label: "Tree" },
  { key: "clusters", label: "Clusters" },
  { key: "map", label: "Map" },
] as const;

export default function FamilyPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();
  const { state, hydrated, currentUser, loadError, refresh, removeMember } = useStore();

  const [selection, setSelection] = useState<Selection | null>(null);
  const [meMode, setMeMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [isolatedId, setIsolatedId] = useState<string | null>(null);
  const [clusterKey, setClusterKey] = useState<ClusterKey>("currentCity");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [addAnchorId, setAddAnchorId] = useState<string | null>(null);
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [childrenParentId, setChildrenParentId] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Set when the invite is opened from a specific relative; left undefined
  // from the toolbar, where the modal asks who first.
  const [invitePersonId, setInvitePersonId] = useState<string | undefined>(undefined);
  const [membersOpen, setMembersOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  // when set, the next canvas click fills that slot instead of opening a panel
  const [pickingFor, setPickingFor] = useState<"a" | "b" | null>(null);
  const [tracedPath, setTracedPath] = useState<PathHighlight | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const toast = useToast();
  const { run } = useAction();
  const narrow = useNarrow();
  const [clustersHint, setClustersHint] = useState(true);

  const family = state.families.find((f) => f.id === familyId);
  // the lightest possible moderation: whoever started the tree can remove members
  const isCreator = !!currentUser && family?.createdById === currentUser.id;
  const isMember = !!currentUser && state.memberships.some(
    (m) => m.familyId === familyId && m.userId === currentUser.id
  );
  const people = useMemo(
    () => state.people.filter((p) => p.familyId === familyId),
    [state.people, familyId]
  );
  const members = useMemo(
    () => state.memberships.filter((m) => m.familyId === familyId),
    [state.memberships, familyId]
  );
  // The stack shows everyone else; you are the account button next to it.
  const others = useMemo(
    () => members.filter((m) => m.userId !== currentUser?.id),
    [members, currentUser?.id]
  );
  const disputedCount = useMemo(() => {
    const relIds = new Set(
      state.relationships.filter((r) => r.familyId === familyId).map((r) => r.id)
    );
    const disputedRels = new Set(
      state.confirmations
        .filter((c) => c.type === "DISPUTE" && relIds.has(c.relationshipId))
        .map((c) => c.relationshipId)
    );
    return disputedRels.size;
  }, [state.relationships, state.confirmations, familyId]);

  const suggestionCount = useMemo(
    () =>
      allSuggestions(
        state.relationships.filter((r) => r.familyId === familyId),
        state.dismissedSuggestions
      ).length,
    [state.relationships, state.dismissedSuggestions, familyId]
  );

  // Typing re-dims every node on the canvas. The list of results stays on the
  // live value so the dropdown never lags a letter behind; the canvas takes
  // the deferred one and repaints when there's a frame to spare.
  const deferredSearch = useDeferredValue(search);

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    return people
      .filter((p) => personMatches(p, q))
      .slice(0, 6)
      .map((p) => ({ person: p, hint: personMatch(p, q) }));
  }, [search, people]);

  // your claimed node in this family — anchors the "Me" highlight
  const mePersonId = useMemo(
    () => people.find((p) => p.accountUserId === currentUser?.id)?.id ?? null,
    [people, currentUser?.id]
  );

  const pathHighlight: PathHighlight | null = useMemo(() => {
    // a traced kinship result takes precedence over the "Me" highlight
    if (tracedPath) return tracedPath;
    if (!meMode || !mePersonId) return null;
    if (selection?.kind !== "person" || selection.id === mePersonId) return null;
    const familyRels = state.relationships.filter((r) => r.familyId === familyId);
    const path = findPath(familyRels, mePersonId, selection.id);
    return path ? { personIds: path.personIds, relationshipIds: path.relationshipIds } : null;
  }, [meMode, mePersonId, selection, state.relationships, familyId, tracedPath]);

  // Signed out once the store has settled. Middleware normally redirects
  // first; this keeps the page from waiting on a session that isn't coming.
  useEffect(() => {
    if (hydrated && !currentUser) {
      router.replace(`/login?next=${encodeURIComponent(`/family/${familyId}`)}`);
    }
  }, [hydrated, currentUser, familyId, router]);

  if (!hydrated) return <LoadingScreen label="Opening this tree…" />;
  if (!currentUser) return <LoadingScreen label="Taking you to sign in…" />;

  // Without this, a failed load looks identical to a family that doesn't
  // exist, and tells the member their own tree is gone.
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
        <p className="max-w-sm text-stone-500">
          {family
            ? "Only members of this family can see its tree. Ask a relative for an invite link."
            : "That family doesn't exist — the link may be wrong."}
        </p>
        <Link
          href="/dashboard"
          className="mt-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          Back to your families
        </Link>
      </main>
    );
  }

  const flyTo = (personId: string) => {
    setFocusPersonId(personId);
    setFocusNonce((n) => n + 1);
  };

  const selectPerson = (id: string) => {
    setSelection({ kind: "person", id });
    flyTo(id);
  };

  // h-screen first, h-dvh second: dvh only arrived in iOS 15.4, and where it
  // isn't understood the whole declaration is dropped — leaving <main> with no
  // height at all, which collapses the canvas and the sheet inside it. The
  // older unit is a worse answer than dvh but an infinitely better one than
  // none.
  return (
    <main className="flex h-screen h-[100dvh] flex-col overflow-hidden bg-stone-50">
      {/* ─── Header ─── */}
      <header className="z-20 border-b border-stone-200/70 bg-white">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <Link
            href="/dashboard"
            aria-label="Back to families"
            className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1 sm:basis-40">
            <h1 className="font-display truncate text-base font-semibold leading-tight text-stone-900 sm:text-lg">
              {family.name}
            </h1>
            <p className="truncate text-xs text-stone-400">
              {people.length} {people.length === 1 ? "person" : "people"} ·{" "}
              {members.length} {members.length === 1 ? "member" : "members"}
              {disputedCount > 0 && (
                <span className="text-red-500">
                  {" "}· {disputedCount} disputed {disputedCount === 1 ? "branch" : "branches"}
                </span>
              )}
            </p>
          </div>

          {/* View toggle — desktop only; mobile gets a thumb-reachable bar */}
          <div className="hidden shrink-0 items-center rounded-xl bg-stone-100 p-0.5 sm:flex">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === v.key
                    ? "bg-white text-teal-900 shadow-sm ring-1 ring-stone-900/5"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Tree Beta — a separate page for trying new layouts out. Nothing
              on it writes, and nothing on this page depends on it. */}
          <Link
            href={`/family/${familyId}/beta`}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 sm:flex"
            title="Try the experimental world view"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-24 12 12)" />
            </svg>
            Beta
          </Link>

          {/* Search */}
          <div className="relative hidden w-56 md:block">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Find someone…"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
            />
            {searchFocused && searchResults.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                {searchResults.map(({ person: p, hint }) => (
                  <li key={p.id}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        selectPerson(p.id);
                        setSearch("");
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-stone-50"
                    >
                      <Avatar name={p.name} id={p.name} size={24} src={p.photoUrl} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-stone-700">{p.name}</span>
                        {hint && (
                          <span className="block truncate text-[11px] text-stone-400">
                            {hint}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* search as an icon on small screens */}
          <button
            onClick={() => setMobileSearch((v) => !v)}
            aria-label="Search"
            className={`shrink-0 rounded-lg p-2 transition md:hidden ${
              mobileSearch ? "bg-stone-100 text-stone-700" : "text-stone-400 hover:bg-stone-100"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>

          {/* Other members only. Your own face belongs to the account button
              beside this, and showing it in both places made the stack read as
              "you" — which is why pressing it opened a members list nobody
              asked for. */}
          {others.length > 0 && (
            <button
              onClick={() => setMembersOpen(true)}
              className="hidden items-center -space-x-1.5 sm:flex"
              title="Family members"
            >
              {others.slice(0, 4).map((m) => {
                const u = state.users.find((u) => u.id === m.userId);
                return u ? (
                  <Avatar key={m.id} name={u.name} id={u.id} size={28} className="ring-2 ring-white" />
                ) : null;
              })}
              {others.length > 4 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-[10px] font-semibold text-stone-500 ring-2 ring-white">
                  +{others.length - 4}
                </span>
              )}
            </button>
          )}

          <Link
            href="/settings"
            title="Your account"
            aria-label="Your account settings"
            className="hidden rounded-full ring-2 ring-white transition hover:ring-teal-700/30 sm:block"
          >
            <Avatar name={currentUser.name} id={currentUser.id} size={28} />
          </Link>

          {suggestionCount > 0 && (
            <button
              onClick={() => setReviewOpen(true)}
              title={`${suggestionCount} assumed connections to review`}
              className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-teal-700/30 bg-teal-800/5 px-2.5 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-800/10 sm:flex"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" />
              </svg>
              {suggestionCount}
              <span className="hidden lg:inline">to review</span>
            </button>
          )}

          <GhostButton onClick={() => { setInvitePersonId(undefined); setInviteOpen(true); }} className="hidden !px-3 !py-2 text-xs sm:inline-flex sm:text-sm">
            Invite
          </GhostButton>

          {/* everything that doesn't fit on a phone lives behind one menu */}
          <div className="relative shrink-0 sm:hidden">
            <button
              onClick={() => setMobileMenu((v) => !v)}
              aria-label="More actions"
              className="relative rounded-lg p-2 text-stone-500 transition hover:bg-stone-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
              {suggestionCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-teal-700 ring-2 ring-white" />
              )}
            </button>
            {mobileMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMobileMenu(false)} />
                <div className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                  {suggestionCount > 0 && (
                    <button
                      onClick={() => { setMobileMenu(false); setReviewOpen(true); }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                    >
                      Assumed connections
                      <span className="rounded-full bg-teal-800/10 px-2 py-0.5 text-xs font-semibold text-teal-800">
                        {suggestionCount}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => { setMobileMenu(false); setMembersOpen(true); }}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                  >
                    Family members
                    <span className="text-xs text-stone-400">{members.length}</span>
                  </button>
                  <button
                    onClick={() => { setMobileMenu(false); setInvitePersonId(undefined); setInviteOpen(true); }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                  >
                    Invite someone
                  </button>
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenu(false)}
                    className="block w-full px-3.5 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                  >
                    Account settings
                  </Link>
                </div>
              </>
            )}
          </div>

          <PrimaryButton
            onClick={() => {
              setAddAnchorId(null);
              setAddOpen(true);
            }}
            aria-label="Add person"
            className="!px-2.5 !py-2 text-xs sm:!px-3 sm:text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">Add person</span>
          </PrimaryButton>
        </div>

      </header>

      {mobileSearch && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)] md:hidden">
          <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find someone by name, city, college…"
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => {
                setMobileSearch(false);
                setSearch("");
              }}
              className="shrink-0 px-2 py-2 text-sm font-semibold text-teal-800"
            >
              Cancel
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {search.trim() && searchResults.length === 0 && (
              <li className="px-5 py-8 text-sm text-stone-400">No one matches that.</li>
            )}
            {searchResults.map(({ person: p, hint }) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    selectPerson(p.id);
                    setSearch("");
                    setMobileSearch(false);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-stone-50"
                >
                  <Avatar name={p.name} id={p.name} size={36} src={p.photoUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-stone-800">{p.name}</span>
                    {hint && (
                      <span className="block truncate text-xs text-stone-400">{hint}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Canvas ─── */}
      <div className="relative min-h-0 flex-1">
        {viewMode === "map" ? (
          <GlobeView people={people} onSelectPerson={selectPerson} />
        ) : (
          <TreeCanvas
            familyId={familyId}
            selection={selection}
            onSelect={(s) => {
              if (pickingFor && s?.kind === "person") {
                if (pickingFor === "a") setCompareAId(s.id);
                else setCompareBId(s.id);
                setPickingFor(null);
                setCompareOpen(true);
                return;
              }
              setSelection(s);
            }}
            searchQuery={deferredSearch}
            focusPersonId={focusPersonId}
            focusNonce={focusNonce}
            highlight={pathHighlight}
            mode={viewMode}
            clusterKey={clusterKey}
            isolateId={isolatedId}
            rightInset={selection && !narrow ? 356 : 0}
            onQuickAdd={(id) => {
              setAddAnchorId(id);
              setAddOpen(true);
            }}
          />
        )}

        {/* Pick-from-tree prompt */}
        {pickingFor && (
          <div className="animate-rise absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border py-1.5 pl-3 pr-1.5 shadow-md backdrop-blur sm:top-4 sm:gap-3 sm:rounded-full sm:py-2 sm:pl-4 sm:pr-2 border-teal-700/30 bg-teal-800 text-white">
            <span className="min-w-0 truncate text-xs sm:text-sm">
              Tap 
              {pickingFor === "b" && compareAId
                ? `someone to compare with ${
                    people.find((p) => p.id === compareAId)?.name.split(" ")[0] ?? "them"
                  }`
                : "the person you want"}
            </span>
            <button
              onClick={() => {
                setPickingFor(null);
                setCompareOpen(true);
              }}
              className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Traced kinship banner */}
        {tracedPath && !pickingFor && viewMode === "tree" && (
          <div className="animate-rise absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border py-1.5 pl-3 pr-1.5 shadow-md backdrop-blur sm:top-4 sm:gap-3 sm:rounded-full sm:py-2 sm:pl-4 sm:pr-2 border-teal-700/25 bg-white/95">
            <span className="flex min-w-0 items-baseline gap-1 text-xs text-stone-600 sm:text-sm">
              <span className="truncate font-semibold text-stone-900">
                {people.find((p) => p.id === tracedPath.personIds[0])?.name}
              </span>
              <span className="shrink-0">→</span>
              <span className="truncate font-semibold text-stone-900">
                {people.find((p) => p.id === tracedPath.personIds.at(-1))?.name}
              </span>
            </span>
            <button
              onClick={() => setTracedPath(null)}
              className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 transition hover:bg-stone-200"
            >
              Clear
            </button>
          </div>
        )}

        {/* Isolate banner */}
        {isolatedId && !tracedPath && !pickingFor && viewMode === "tree" && (
          <div className="animate-rise absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border py-1.5 pl-3 pr-1.5 shadow-md backdrop-blur sm:top-4 sm:gap-3 sm:rounded-full sm:py-2 sm:pl-4 sm:pr-2 border-teal-700/25 bg-white/95">
            <span className="flex min-w-0 items-baseline text-xs text-stone-600 sm:text-sm">
              <span className="truncate font-semibold text-stone-900">
                {people.find((p) => p.id === isolatedId)?.name ?? "this person"}
              </span>
              <span className="shrink-0">&apos;s family</span>
            </span>
            <button
              onClick={() => setIsolatedId(null)}
              className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 transition hover:bg-stone-200"
            >
              Show all
            </button>
          </div>
        )}

        {/* Shown on every visit, not once: this warns that what's on screen
            may be wrong, and that stays true however many times you've seen it. */}
        {viewMode === "clusters" && clustersHint && (
          <div className="absolute inset-x-3 top-3 z-10 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 sm:inset-x-auto sm:left-4 sm:right-4 sm:max-w-md">
            <p className="min-w-0 text-xs leading-relaxed text-amber-900">
              Clusters is in beta — grouping can be rough where details are
              half filled in. Nothing here changes your tree.
            </p>
            <button
              type="button"
              onClick={() => setClustersHint(false)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-amber-900"
            >
              OK
            </button>
          </div>
        )}

        {/* Cluster-by picker */}
        {viewMode === "clusters" && (
          <div className={`absolute left-3 z-10 flex items-center gap-2 rounded-xl border border-stone-200/80 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur sm:left-4 sm:px-3 sm:py-2 ${
              clustersHint ? "top-16 sm:top-20" : "top-3 sm:top-4"
            }`}>
            <span className="hidden text-xs font-semibold uppercase tracking-wider text-stone-400 sm:inline">
              Cluster by
            </span>
            <select
              value={clusterKey}
              onChange={(e) => setClusterKey(e.target.value as ClusterKey)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-800 outline-none transition focus:border-teal-600"
            >
              {CLUSTER_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Empty state */}
        {people.length === 0 && viewMode !== "map" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="animate-rise mx-6 max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xl">
              <p className="font-display text-xl font-semibold text-stone-900">
                Every tree starts with one person.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                Add yourself first — or a grandparent you remember — and mark
                the person who is you. Then branch out. The rest of the family
                can help once you invite them.
              </p>
              <PrimaryButton
                onClick={() => {
                  setAddAnchorId(null);
                  setAddOpen(true);
                }}
                className="mt-5"
              >
                Add the first person
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Legend */}
        {people.length > 0 && viewMode === "tree" && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden rounded-xl border border-stone-200/80 bg-white/90 px-3.5 py-2.5 text-[11px] text-stone-500 shadow-sm backdrop-blur sm:block">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-1.5 rounded-sm bg-teal-700" />
                blood
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-1.5 rounded-sm" style={{ background: "#c2620c" }} />
                married in
              </span>
              <span className="h-3.5 w-px bg-stone-200" />
              <LegendItem color="#78716c">parent</LegendItem>
              <LegendItem color="#e11d48">spouse</LegendItem>
              <LegendItem color="#dc2626" dashed>disputed</LegendItem>
              <LegendItem color="#0d9488" dotted>assumed</LegendItem>
            </div>
          </div>
        )}

        {/* Detail panel — explicit height so the inner overflow-y-auto is a
            real scrollport. max-h alone let the card grow and handed swipes
            to the canvas underneath. */}
        {selection && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex h-[72%] max-h-full flex-col overflow-hidden overscroll-contain sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:h-auto sm:max-h-none">
            <DetailPanel
              selection={selection}
              onClose={() => setSelection(null)}
              onSelectPerson={selectPerson}
              onSelectRelationship={(id) => setSelection({ kind: "relationship", id })}
              onInvite={(id) => {
                setInvitePersonId(id);
                setInviteOpen(true);
              }}
              mePersonId={mePersonId}
              meModeOn={meMode}
              onToggleMeMode={() => setMeMode((m) => !m)}
              pathFound={!!pathHighlight}
              isolatedId={isolatedId}
              onToggleIsolate={(id) => {
                setIsolatedId((cur) => (cur === id ? null : id));
                setViewMode("tree");
              }}
              onCompare={(id) => {
                setCompareAId(id);
                setCompareBId(null);
                setCompareOpen(true);
              }}
              onAddRelative={(anchorId) => {
                setAddAnchorId(anchorId);
                setAddOpen(true);
              }}
              onAddChildren={(parent) => {
                setChildrenParentId(parent);
                setChildrenOpen(true);
              }}
              onConnectFrom={(personId) => {
                setConnectFromId(personId);
                setConnectOpen(true);
              }}
            />
          </div>
        )}
      </div>

      <nav
        aria-label="Views"
        className="z-20 shrink-0 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="grid grid-cols-3">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setViewMode(v.key)}
              aria-current={viewMode === v.key ? "page" : undefined}
              // min-h-11 is the ~44px Apple asks for. At py-2.5 these were
              // nearer 40 and sat right above the home indicator, which is a
              // bad combination on a phone.
              className={`flex min-h-11 items-center justify-center px-2 text-sm font-semibold transition ${
                viewMode === v.key
                  ? "text-teal-800"
                  : "text-stone-400 active:text-stone-600"
              }`}
            >
              <span className="relative">
                {v.label}
                {viewMode === v.key && (
                  <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-teal-800" />
                )}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* ─── Modals ─── */}
      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        familyId={familyId}
        people={people}
        anchorPersonId={addAnchorId}
        mePersonId={mePersonId}
        onAdded={(id) => selectPerson(id)}
      />
      <AddChildrenModal
        open={childrenOpen}
        onClose={() => setChildrenOpen(false)}
        familyId={familyId}
        people={people}
        parentId={childrenParentId}
        mePersonId={mePersonId}
      />
      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        familyId={familyId}
        people={people}
        initialFromId={connectFromId}
        mePersonId={mePersonId}
      />
      <InvitePersonModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        familyId={familyId}
        personId={invitePersonId}
      />
      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        familyId={familyId}
        onGoToPerson={selectPerson}
      />
      <RelationshipModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        people={people}
        aId={compareAId}
        bId={compareBId}
        mePersonId={mePersonId}
        onChangeA={setCompareAId}
        onChangeB={setCompareBId}
        onSwap={() => {
          setCompareAId(compareBId);
          setCompareBId(compareAId);
        }}
        onPickFromTree={(which) => {
          // step aside so the canvas is clear to click on
          setCompareOpen(false);
          setSelection(null);
          setViewMode("tree");
          setPickingFor(which);
        }}
        onSelectPerson={selectPerson}
        onShowPath={(p) => {
          setTracedPath(p);
          setIsolatedId(null);
          setViewMode("tree");
          setSelection(null);
        }}
      />

      {/* Members */}
      <Modal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        title="Family members"
        subtitle="Everyone here can add, edit, confirm, and dispute — equally."
      >
        {isCreator && members.length > 1 && (
          <p className="mb-3 rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs leading-relaxed text-stone-500">
            You started this family, so you can remove members. Anything they
            added stays in the tree, still credited to them.
          </p>
        )}
        <ul className="space-y-2">
          {members.map((m) => {
            const u = state.users.find((u) => u.id === m.userId);
            if (!u) return null;
            const added = state.people.filter(
              (p) => p.familyId === familyId && p.addedById === u.id
            ).length;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-stone-50 px-3.5 py-2.5"
              >
                <span className="flex items-center gap-3">
                  <Avatar name={u.name} id={u.id} size={34} />
                  <span>
                    <span className="block text-sm font-medium text-stone-800">
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase text-stone-400">
                          you
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-stone-400">
                      joined {timeAgo(m.joinedAt)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">
                    {added} {added === 1 ? "person" : "people"} added
                  </span>
                  {u.id === family.createdById ? (
                    <span className="rounded-full bg-teal-800/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                      creator
                    </span>
                  ) : (
                    isCreator && (
                      <DangerButton
                        label="Remove"
                        confirmLabel="Remove them?"
                        className="!px-2 !py-1 text-xs"
                        onConfirm={() =>
                          void run(() => removeMember(familyId, u.id), {
                            failure: `Couldn't remove ${u.name}`,
                          }).then((removed) => {
                            if (removed) toast(`${u.name} removed from this family`, "info");
                          })
                        }
                      />
                    )
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-end">
          <PrimaryButton
            onClick={() => {
              setMembersOpen(false);
              setInvitePersonId(undefined);
              setInviteOpen(true);
            }}
          >
            Invite someone
          </PrimaryButton>
        </div>
      </Modal>
    </main>
  );
}

function LegendItem({
  color,
  dashed,
  dotted,
  children,
}: {
  color: string;
  dashed?: boolean;
  dotted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="6">
        <line
          x1="0" y1="3" x2="18" y2="3"
          stroke={color}
          strokeWidth="2"
          strokeLinecap={dotted ? "round" : undefined}
          strokeDasharray={dotted ? "0.5 4" : dashed ? "4 3" : undefined}
        />
      </svg>
      {children}
    </span>
  );
}
