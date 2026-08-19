"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { computeProfile } from "@/lib/profile";
import { timeAgo } from "@/lib/helpers";
import {
  Avatar,
  Field,
  GhostButton,
  inputCls,
  LoadingScreen,
  Modal,
  PrimaryButton,
  useToast,
} from "@/components/ui";

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

export default function DashboardPage() {
  const { state, hydrated, currentUser, loadError, createFamily, joinFamilyByCode, signOut, refresh } =
    useStore();
  const router = useRouter();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const profile = useMemo(
    () => (currentUser ? computeProfile(state, currentUser.id) : null),
    [state, currentUser]
  );

  // Signed out once the store has settled: middleware normally catches this,
  // but if it ever fails open this page would sit on a spinner forever.
  useEffect(() => {
    if (hydrated && !currentUser) router.replace("/login?next=/dashboard");
  }, [hydrated, currentUser, router]);

  if (!hydrated) return <LoadingScreen label="Loading your trees…" />;
  if (!currentUser || !profile) return <LoadingScreen label="Taking you to sign in…" />;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await createFamily(name);
      setCreateOpen(false);
      setNewName("");
      toast(`Created “${name}”`);
      router.push(`/family/${id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't create that family", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await joinFamilyByCode(joinCode);
      if (!res.ok) {
        setJoinError(res.error ?? "Something went wrong.");
        return;
      }
      setJoinOpen(false);
      setJoinCode("");
      toast("Welcome to the family!");
      router.push(`/family/${res.familyId}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setJoining(false);
    }
  };

  const close = profile.closeCounts;
  const hasAnyStats =
    profile.totalRelatives > 0 || profile.families.some((f) => f.selfPersonId);

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-lg font-semibold text-stone-900">
            Dynasty
          </Link>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
            className="text-xs font-medium text-stone-400 transition hover:text-stone-600"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* ── Profile header ── */}
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={currentUser.name} id={currentUser.id} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
              {currentUser.name}
            </h1>
            <p className="mt-1 text-stone-500">
              {profile.totalRelatives} recorded {profile.totalRelatives === 1 ? "relative" : "relatives"}{" "}
              across {profile.families.length}{" "}
              {profile.families.length === 1 ? "family tree" : "family trees"}
            </p>
          </div>
          <div className="flex gap-2.5">
            <GhostButton onClick={() => { setJoinOpen(true); setJoinError(null); }}>
              Join with code
            </GhostButton>
            <PrimaryButton onClick={() => setCreateOpen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New family
            </PrimaryButton>
          </div>
        </div>

        {!hasAnyStats && (
          <p className="mt-8 rounded-2xl border border-dashed border-stone-200 px-5 py-6 text-center text-sm leading-relaxed text-stone-500">
            Your stats appear once you&apos;re placed in a tree. Open a family and
            claim your own node to see how everyone connects back to you.
          </p>
        )}

        {/* ── Headline stats ── */}
        {hasAnyStats && (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Oldest living relative"
                value={
                  profile.oldestLiving
                    ? profile.oldestLiving.person.name
                    : "Not recorded"
                }
                sub={
                  profile.oldestLiving
                    ? `${profile.oldestLiving.age} years old · ${profile.oldestLiving.familyName}`
                    : "Mark someone as living to see this"
                }
              />
              <Stat
                label="Cities with relatives"
                value={String(profile.citiesWithRelatives)}
                sub={
                  profile.citiesWithRelatives
                    ? "based on recorded current cities"
                    : "add a current city to anyone"
                }
              />
              <Stat
                label="Most relatives living in"
                value={profile.topCity ? profile.topCity.city : "—"}
                sub={
                  profile.topCity
                    ? `${profile.topCity.count} ${profile.topCity.count === 1 ? "person" : "people"}`
                    : "no cities recorded yet"
                }
              />
              <Stat
                label="Living relatives"
                value={String(profile.livingCount)}
                sub={
                  profile.unknownStatusCount
                    ? `${profile.unknownStatusCount} with status unknown`
                    : "all statuses recorded"
                }
              />
            </div>

            {/* ── Cousins & close family ── */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-stone-200/80 bg-white p-5">
                <h2 className="font-display text-lg font-semibold text-stone-900">
                  Cousins
                </h2>
                {profile.cousinsByDegree.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-400">
                    No cousins recorded yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {profile.cousinsByDegree.map(({ degree, count }) => {
                      const max = Math.max(
                        ...profile.cousinsByDegree.map((c) => c.count)
                      );
                      return (
                        <li key={degree} className="flex items-center gap-3">
                          <span className="w-24 shrink-0 text-sm text-stone-600">
                            {ORDINAL[degree] ?? `${degree}th`} cousins
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                            <span
                              className="block h-full rounded-full bg-teal-700"
                              style={{ width: `${(count / max) * 100}%` }}
                            />
                          </span>
                          <span className="w-7 shrink-0 text-right text-sm font-semibold text-stone-800">
                            {count}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-stone-200/80 bg-white p-5">
                <h2 className="font-display text-lg font-semibold text-stone-900">
                  Close family
                </h2>
                <dl className="mt-3 grid grid-cols-3 gap-3">
                  <Mini label="Parents" value={close.parents} />
                  <Mini label="Siblings" value={close.siblings} />
                  <Mini label="Children" value={close.children} />
                  <Mini label="Grandparents" value={close.grandparents} />
                  <Mini label="Aunts & uncles" value={close.auntsUncles} />
                  <Mini label="Nieces & nephews" value={close.niecesNephews} />
                </dl>
              </section>
            </div>
          </>
        )}

        {/* ── Families ── */}
        <h2 className="font-display mt-10 text-xl font-semibold tracking-tight text-stone-900">
          Your family trees
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {profile.families.map((f) => {
            const members = state.memberships.filter(
              (m) => m.familyId === f.familyId
            );
            const lastActivity = state.people
              .filter((p) => p.familyId === f.familyId)
              .map((p) => p.createdAt)
              .sort()
              .at(-1);
            return (
              <Link
                key={f.familyId}
                href={`/family/${f.familyId}`}
                className="group rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-800/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-semibold text-stone-900 group-hover:text-teal-900">
                    {f.familyName}
                  </h3>
                  <svg
                    className="mt-1 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-teal-800"
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {f.people} {f.people === 1 ? "person" : "people"} ·{" "}
                  {f.generations} {f.generations === 1 ? "generation" : "generations"} ·{" "}
                  {members.length} {members.length === 1 ? "member" : "members"}
                </p>
                {!f.selfPersonId && (
                  <p className="mt-2 inline-block rounded-full bg-amber-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    You&apos;re not in this tree yet
                  </p>
                )}
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {members.slice(0, 5).map((m) => {
                      const u = state.users.find((u) => u.id === m.userId);
                      return u ? (
                        <Avatar key={m.id} name={u.name} id={u.id} size={28} className="ring-2 ring-white" />
                      ) : null;
                    })}
                  </div>
                  {lastActivity && (
                    <span className="text-xs text-stone-400">
                      last addition {timeAgo(lastActivity)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          <button
            onClick={() => setCreateOpen(true)}
            className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 transition hover:border-teal-800/40 hover:text-teal-800"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-sm font-medium">Start a new family tree</span>
          </button>
        </div>

        {loadError && (
          <p className="mt-10 text-center text-sm text-red-700">
            Couldn&apos;t load your trees.{" "}
            <button className="underline" onClick={() => void refresh()}>
              Try again
            </button>
          </p>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Start a new family tree"
        subtitle="You'll be its first member — invite everyone else with a link."
      >
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-5">
          <Field label="Family name">
            <input
              autoFocus
              className={inputCls}
              placeholder="e.g. The Okafor Family"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2.5">
            <GhostButton type="button" onClick={() => setCreateOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={!newName.trim() || creating}>
              {creating ? "Creating…" : "Create family"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join a family"
        subtitle="Paste the invite code a relative shared with you."
      >
        <form onSubmit={(e) => { e.preventDefault(); void handleJoin(); }} className="space-y-5">
          <Field label="Invite code">
            <input
              autoFocus
              className={`${inputCls} font-mono uppercase tracking-wider`}
              placeholder="FAMILY-CODE"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(null); }}
            />
          </Field>
          {joinError && (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{joinError}</p>
          )}
          <div className="flex justify-end gap-2.5">
            <GhostButton type="button" onClick={() => setJoinOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={!joinCode.trim() || joining}>
              {joining ? "Joining…" : "Join family"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p className="font-display mt-1 truncate text-xl font-semibold text-stone-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] leading-tight text-stone-500">{label}</dt>
      <dd className="font-display text-2xl font-semibold text-stone-900">{value}</dd>
    </div>
  );
}
