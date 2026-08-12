import Link from "next/link";

const features = [
  {
    title: "Everyone holds the pen",
    body: "No single admin owns the tree. Any family member can add a relative, attach a story, or draw a connection — the tree grows the way memory actually works: together.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Every branch signed",
    body: "Each person and connection permanently records who added it and when. Provenance isn't an afterthought — it's the foundation, so family lore always has a source.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    title: "Confirmed by the family",
    body: "Was Ernesto really Grandpa's brother? Members confirm or dispute any connection. Contested branches stay visibly flagged until the family sorts it out — nothing is silently erased.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 3a9 9 0 1 0 9 9" />
        <path d="M21 3l-6.5 6.5" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <Link
          href="/dashboard"
          className="rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          Open your trees
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-14 text-center sm:pt-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-800/15 bg-teal-800/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-800">
          Private · Collaborative · Corroborated
        </p>
        <h1 className="font-display mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-6xl">
          A family tree the whole family writes.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
          Rootline is a shared space for your family&apos;s history. Anyone can add a
          relative, every addition is signed, and the family confirms what&apos;s true —
          no gatekeepers, no lost lore.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-teal-800 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/10 transition hover:bg-teal-700"
          >
            Start your tree
          </Link>
          <Link
            href="/family/f-rivera"
            className="rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-100"
          >
            See a live example
          </Link>
        </div>

        {/* Mini tree illustration */}
        <div className="mx-auto mt-16 max-w-2xl rounded-3xl border border-stone-200/80 bg-white p-8 shadow-xl shadow-stone-900/5">
          <MiniTree />
          <p className="mt-6 text-xs text-stone-400">
            Dashed red branches are disputed — the family sees the disagreement, not a silent edit.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title}>
              <div className="mb-4 inline-flex rounded-2xl bg-teal-800/8 p-3 text-teal-800" style={{ backgroundColor: "rgba(17,94,89,0.08)" }}>
                {f.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-5xl items-center justify-between px-6 py-10 text-sm text-stone-400">
        <Logo muted />
        <span>Your tree is private to your family.</span>
      </footer>
    </main>
  );
}

function Logo({ muted = false }: { muted?: boolean }) {
  return (
    <span className={`font-display inline-flex items-center gap-2 text-lg font-semibold ${muted ? "text-stone-400" : "text-stone-900"}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={muted ? "#a8a29e" : "#115e59"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2.4" />
        <circle cx="5.5" cy="18" r="2.4" />
        <circle cx="18.5" cy="18" r="2.4" />
        <path d="M12 7.4V12m0 0l-5 3.8M12 12l5 3.8" />
      </svg>
      Rootline
    </span>
  );
}

function MiniTree() {
  const node = (x: number, y: number, label: string, sub?: string) => (
    <g transform={`translate(${x},${y})`}>
      <rect x="-52" y="-20" width="104" height="40" rx="10" fill="#fff" stroke="#e7e5e4" />
      <text x="0" y={sub ? -2 : 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1c1917">
        {label}
      </text>
      {sub && (
        <text x="0" y="12" textAnchor="middle" fontSize="8.5" fill="#a8a29e">
          {sub}
        </text>
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 560 260" className="w-full">
      {/* edges */}
      <path d="M170 60 H 290" stroke="#f43f5e" strokeWidth="1.6" opacity="0.55" />
      <path d="M170 80 V 110 H 230 V 140" stroke="#a8a29e" strokeWidth="1.5" fill="none" />
      <path d="M290 80 V 110 H 230 V 140" stroke="#a8a29e" strokeWidth="1.5" fill="none" />
      <path d="M170 80 V 110 H 380 V 140" stroke="#a8a29e" strokeWidth="1.5" fill="none" />
      <path d="M230 180 V 200 H 160 V 220" stroke="#a8a29e" strokeWidth="1.5" fill="none" />
      <path d="M230 180 V 200 H 300 V 220" stroke="#a8a29e" strokeWidth="1.5" fill="none" />
      <path d="M60 60 H 118" stroke="#ef4444" strokeWidth="1.6" strokeDasharray="5 4" />
      {node(60, 60, "Ernesto", "disputed · +1/−1")}
      {node(170, 60, "Miguel", "1938–2011")}
      {node(290, 60, "Elena", "b. 1942")}
      {node(230, 160, "Carlos", "added by Jordan")}
      {node(380, 160, "Sofía", "added by Carol")}
      {node(160, 240, "Jordan", "that's you")}
      {node(300, 240, "Maya", "confirmed ✓")}
    </svg>
  );
}
