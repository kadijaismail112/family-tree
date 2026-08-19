"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  loadGazetteer,
  resolvePlace,
  searchPlaces,
  type Place,
  type Suggestion,
} from "@/lib/gazetteer";
import { inputCls } from "./ui";

/**
 * A place field that tells the user whether what they typed will actually
 * land on the map.
 *
 * The plain text input this replaces accepted anything and failed silently:
 * an unrecognised town saved fine, then quietly vanished from the globe. Here
 * the match state is always visible while typing, and an unmatched value is
 * still saveable — it just says plainly that it won't be placed.
 */
export function CityInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  const listId = useId();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadGazetteer>> | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Set when the user picks a suggestion, so we can show a settled
  // confirmation instead of re-deriving a match from the text.
  const [chosen, setChosen] = useState<Place | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const ensureLoaded = () => {
    if (data || status === "loading") return;
    setStatus("loading");
    loadGazetteer()
      .then((d) => {
        setData(d);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  };

  // A field that opens with a value still needs the data, or an already-valid
  // city would sit there being reported as unrecognised.
  useEffect(() => {
    if (value.trim()) ensureLoaded();
    // Only on mount: later edits load via onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confirm a value that arrived already filled in (editing an existing city).
  useEffect(() => {
    if (!data || chosen || !value.trim()) return;
    const match = resolvePlace(data, value);
    if (match) setChosen(match);
  }, [data, value, chosen]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const suggestions: Suggestion[] = useMemo(() => {
    if (!data || !value.trim()) return [];
    return searchPlaces(data, value, 8);
  }, [data, value]);

  // What the user typed matches a real place, even without picking from the list.
  const resolved = useMemo(() => {
    if (chosen) return chosen;
    if (!data || !value.trim()) return null;
    return resolvePlace(data, value);
  }, [chosen, data, value]);

  const pick = (place: Place) => {
    setChosen(place);
    onChange(place.label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      // Only intercept Enter while a suggestion is highlighted, so the
      // surrounding form still submits normally otherwise.
      e.preventDefault();
      pick(suggestions[active].place);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        autoFocus={autoFocus}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={inputCls}
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          ensureLoaded();
          setOpen(true);
        }}
        onChange={(e) => {
          ensureLoaded();
          setChosen(null);
          setActive(0);
          setOpen(true);
          onChange(e.target.value);
        }}
        onKeyDown={onKeyDown}
      />

      {showList && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10">
        <ul
          id={listId}
          role="listbox"
          className="max-h-64 overflow-auto py-1"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.place.label}-${s.place.lat}-${s.place.lon}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so blur doesn't close first
                pick(s.place);
              }}
              className={`cursor-pointer px-3.5 py-2 text-sm ${
                i === active ? "bg-teal-800/8 text-stone-900" : "text-stone-700"
              }`}
            >
              <span className="font-medium">{s.place.name}</span>
              <span className="text-stone-400">
                {[s.place.region, s.place.country].filter(Boolean).length > 0 && " · "}
                {[s.place.region, s.place.country].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
        </ul>
        {/* GeoNames is CC BY 4.0, which requires visible attribution. Kept
            outside the scroll area so it does not scroll out of sight. */}
        <p className="border-t border-stone-100 px-3.5 py-1.5 text-[10px] text-stone-400">
          Places from{" "}
          <a
            href="https://www.geonames.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-stone-300 underline-offset-2"
          >
            GeoNames
          </a>
          , CC BY 4.0
        </p>
        </div>
      )}

      <FeedbackLine
        status={status}
        hasValue={!!value.trim()}
        resolved={resolved}
        ready={!!data}
      />
    </div>
  );
}

function FeedbackLine({
  status,
  hasValue,
  resolved,
  ready,
}: {
  status: "idle" | "loading" | "error";
  hasValue: boolean;
  resolved: Place | null;
  ready: boolean;
}) {
  if (!hasValue) return null;

  // Until the data is here we genuinely don't know, so say that rather than
  // calling a perfectly good city unrecognised.
  if (!ready && status !== "error") {
    return (
      <p className="mt-1.5 text-xs text-stone-400" aria-live="polite">
        Checking places…
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="mt-1.5 text-xs text-amber-700" aria-live="polite">
        Couldn&apos;t load the place list. Your entry still saves as typed.
      </p>
    );
  }

  if (resolved) {
    return (
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-teal-800" aria-live="polite">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-px shrink-0"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>
          Will appear on the map at <strong>{resolved.label}</strong>
        </span>
      </p>
    );
  }

  return (
    <p className="mt-1.5 text-xs text-amber-700" aria-live="polite">
      Not a place we recognise — this saves fine, but won&apos;t show on the map.
      Try picking from the list as you type.
    </p>
  );
}
