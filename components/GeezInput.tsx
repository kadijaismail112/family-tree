"use client";

import { useEffect, useRef, useState } from "react";
import {
  consonantFamilies,
  GEEZ_PUNCTUATION,
  transliterate,
  VOWEL_ORDERS,
} from "@/lib/geez";
import { inputCls } from "./ui";

/**
 * A text field that can type Ge'ez (Ethiopic) — the script Amharic, Tigrinya
 * and Ge'ez are written in.
 *
 * Two ways in, because the two audiences differ. People who grew up typing the
 * script expect romanised transliteration: spell the sound, get the syllable.
 * People who read it but have never typed it need to see the characters, so
 * there is also a grid of all 35 consonant families against their seven vowel
 * forms.
 *
 * The mode is remembered, since a family that writes in Ge'ez will write every
 * name in Ge'ez and should not have to switch on every field.
 */

const STORAGE_KEY = "dynasty.geez";

// Ethiopic isn't in most default sans stacks; name the faces that ship with
// each platform so the script doesn't land in a fallback box.
const GEEZ_FONTS =
  '"Noto Sans Ethiopic", "Kefa", "Nyala", "Abyssinica SIL", "Ebrima", sans-serif';

export function GeezInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Latin for the word being typed, and the text already settled before it.
  // Keeping them apart is what lets the syllable under construction be
  // rewritten on each keystroke without disturbing anything already entered.
  const pending = useRef("");
  const committed = useRef(value);

  useEffect(() => {
    setOn(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // A value changed from outside (reset, or a different person selected) makes
  // any half-typed syllable meaningless.
  useEffect(() => {
    if (value !== committed.current + transliterate(pending.current)) {
      pending.current = "";
      committed.current = value;
    }
  }, [value]);

  const setMode = (next: boolean) => {
    setOn(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    pending.current = "";
    committed.current = value;
    if (!next) setShowChart(false);
    inputRef.current?.focus();
  };

  const commit = () => {
    committed.current = committed.current + transliterate(pending.current);
    pending.current = "";
  };

  const insert = (text: string) => {
    commit();
    committed.current += text;
    onChange(committed.current);
    inputRef.current?.focus();
  };

  /**
   * Driven from the input event rather than keydown.
   *
   * Keydown looks like the obvious hook and isn't: phone keyboards, dictation,
   * autocomplete and anything routed through an IME frequently insert text
   * without emitting a keydown carrying the character. Diffing what the field
   * now holds against what it held a moment ago catches every one of those,
   * because they all have to produce an input event to change the value.
   */
  const handleInput = (next: string) => {
    if (!on) {
      pending.current = "";
      committed.current = next;
      onChange(next);
      return;
    }

    const prev = value;

    // Text appended at the end — the ordinary case, however it was entered.
    if (next.length > prev.length && next.startsWith(prev)) {
      const added = next.slice(prev.length);
      if (/^[A-Za-z]+$/.test(added)) {
        pending.current += added;
        onChange(committed.current + transliterate(pending.current));
        return;
      }
      // A space or punctuation closes the syllable being built.
      commit();
      committed.current += added;
      onChange(committed.current);
      return;
    }

    // Deleting from the end walks the romanisation back one letter at a time,
    // so backspace undoes typing rather than lopping off a finished syllable.
    if (next.length < prev.length && prev.startsWith(next) && pending.current) {
      pending.current = pending.current.slice(0, -1);
      onChange(committed.current + transliterate(pending.current));
      return;
    }

    // Paste, mid-string editing, select-all-and-replace: take it as given.
    pending.current = "";
    committed.current = next;
    onChange(next);
  };

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          className={`${inputCls} pr-11`}
          style={on ? { fontFamily: GEEZ_FONTS } : undefined}
          placeholder={placeholder}
          value={value}
          lang={on ? "am" : undefined}
          onBlur={commit}
          onChange={(e) => handleInput(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setMode(!on)}
          aria-pressed={on}
          title={on ? "Switch to Latin typing" : "Type in Ge'ez (Amharic / Tigrinya)"}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-semibold transition ${
            on
              ? "bg-teal-800 text-white"
              : "text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          }`}
          style={{ fontFamily: GEEZ_FONTS }}
        >
          አ
        </button>
      </div>

      {on && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-stone-500">
          <span>
            Type it how it sounds — <code className="text-stone-600">selam</code>{" "}
            becomes <span style={{ fontFamily: GEEZ_FONTS }}>ሰላም</span>
          </span>
          <button
            type="button"
            onClick={() => setShowChart((s) => !s)}
            className="ml-auto shrink-0 rounded px-1.5 py-0.5 font-semibold text-teal-800 transition hover:bg-teal-800/10"
          >
            {showChart ? "Hide letters" : "Pick letters"}
          </button>
        </div>
      )}

      {on && showChart && <Chart onPick={insert} />}
    </div>
  );
}

/** All 35 families against their seven vowel forms. */
function Chart({ onPick }: { onPick: (char: string) => void }) {
  const families = consonantFamilies();
  return (
    <div className="mt-2 rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="max-h-64 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th className="w-9 border-b border-stone-100 py-1 text-[9px] font-semibold uppercase tracking-wide text-stone-300">
                key
              </th>
              {VOWEL_ORDERS.map((v) => (
                <th
                  key={v}
                  className="border-b border-stone-100 py-1 text-[9px] font-semibold text-stone-300"
                >
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {families.map((fam) => (
              <tr key={fam.key}>
                <td className="border-b border-stone-50 text-center align-middle font-mono text-[9px] text-stone-400">
                  {fam.key}
                </td>
                {fam.forms.map((ch, i) => (
                  <td key={i} className="border-b border-stone-50 p-0">
                    <button
                      type="button"
                      onClick={() => onPick(ch)}
                      className="h-7 w-full text-[15px] leading-none text-stone-800 transition hover:bg-teal-800/10"
                      style={{ fontFamily: GEEZ_FONTS }}
                    >
                      {ch}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-0.5 border-t border-stone-100 p-1.5">
        {GEEZ_PUNCTUATION.map((p) => (
          <button
            key={p.char}
            type="button"
            title={p.name}
            onClick={() => onPick(p.char)}
            className="rounded px-2 py-0.5 text-sm text-stone-600 transition hover:bg-teal-800/10"
            style={{ fontFamily: GEEZ_FONTS }}
          >
            {p.char}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPick(" ")}
          className="ml-auto rounded px-3 py-0.5 text-[11px] text-stone-500 transition hover:bg-stone-100"
        >
          space
        </button>
      </div>
    </div>
  );
}
