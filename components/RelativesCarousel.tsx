"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SpotlightCard } from "@/lib/spotlight";
import { PERSON_DETAIL_FIELDS } from "@/lib/types";
import { colorFor, formatDateOrYear, initials } from "@/lib/helpers";

const ROTATE_MS = 8000;

export function RelativesCarousel({
  cards,
  claimed,
}: {
  cards: SpotlightCard[];
  claimed: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex((n) => (cards.length === 0 ? 0 : n % cards.length));
  }, [cards.length]);

  useEffect(() => {
    if (cards.length < 2 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(
      () => setIndex((n) => (n + 1) % cards.length),
      ROTATE_MS
    );
    return () => window.clearInterval(id);
  }, [cards.length, paused]);

  const card = cards[index];
  if (!card) return null;

  const { person } = card;
  const born = formatDateOrYear(person.birthDate, person.birthYear);
  const died = formatDateOrYear(person.deathDate, person.deathYear);
  const dates = [born, died].filter(Boolean).join(" – ") || "dates unknown";
  const filled = PERSON_DETAIL_FIELDS.filter((f) => person.details?.[f.key]);

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
            {claimed ? "Related to you this week" : "People in your trees"}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            One relative at a time. Same few faces until next Monday.
          </p>
        </div>
        {cards.length > 1 && (
          <p className="shrink-0 text-xs tabular-nums text-stone-400">
            {index + 1} / {cards.length}
          </p>
        )}
      </div>

      <div
        className="relative mt-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div
          key={person.id}
          className="grid animate-rise md:grid-cols-[minmax(240px,38%)_1fr]"
        >
          <Portrait person={person} />
          <div className="flex min-w-0 flex-col p-5 sm:p-6">
            {card.relation && (
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                {card.relation}
              </p>
            )}
            <h3 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
              {person.name}
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              {dates}
              {person.lifeStatus === "living" && " · living"}
              {person.lifeStatus === "deceased" && " · deceased"}
              {!person.lifeStatus && " · status unknown"}
            </p>
            <p className="mt-0.5 text-sm text-stone-400">{card.familyName}</p>
            {card.via && (
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{card.via}</p>
            )}
            {!card.relation && (
              <p className="mt-2 text-sm text-amber-800">
                Claim yourself in this tree to see how you&apos;re related.
              </p>
            )}

            {person.notes && (
              <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-stone-600">
                {person.notes}
              </p>
            )}

            {filled.length > 0 && (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {filled.map((field) => {
                  const value = person.details?.[field.key] ?? "";
                  const isUrl = field.kind === "url";
                  return (
                    <div key={field.key} className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                        {field.label}
                      </dt>
                      <dd className="mt-0.5 truncate text-sm text-stone-700">
                        {isUrl ? (
                          <a
                            href={value}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-800 underline-offset-2 hover:underline"
                          >
                            {value.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}

            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <Link
                href={`/family/${card.familyId}`}
                className="text-sm font-semibold text-teal-800 transition hover:text-teal-700"
              >
                Open in the tree
              </Link>
              {cards.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous relative"
                    onClick={() =>
                      setIndex((n) => (n - 1 + cards.length) % cards.length)
                    }
                    className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                  >
                    <Arrow dir="left" />
                  </button>
                  <div className="flex gap-1.5">
                    {cards.map((c, i) => (
                      <button
                        key={c.person.id}
                        type="button"
                        aria-label={`Show ${c.person.name}`}
                        aria-current={i === index}
                        onClick={() => setIndex(i)}
                        className={`h-1.5 rounded-full transition ${
                          i === index ? "w-5 bg-teal-800" : "w-1.5 bg-stone-300"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Next relative"
                    onClick={() => setIndex((n) => (n + 1) % cards.length)}
                    className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                  >
                    <Arrow dir="right" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Portrait({ person }: { person: SpotlightCard["person"] }) {
  if (person.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.photoUrl}
        alt={person.name}
        className="h-64 w-full object-cover md:h-full md:min-h-[320px]"
      />
    );
  }
  return (
    <div
      className="flex h-64 items-center justify-center md:h-full md:min-h-[320px]"
      style={{ backgroundColor: colorFor(person.id) }}
    >
      <span className="font-display text-6xl font-semibold text-white/90">
        {initials(person.name)}
      </span>
    </div>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={dir === "left" ? "rotate-180" : ""}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
