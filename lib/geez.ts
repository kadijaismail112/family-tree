/**
 * Ge'ez (Ethiopic) input by romanised transliteration.
 *
 * Ge'ez is an abugida: every consonant carries seven vowel forms, so the
 * script has well over two hundred characters and no useful physical keyboard
 * layout. Ethiopians and Eritreans overwhelmingly type it the way this file
 * works — spell the sound in Latin and let the engine pick the syllable —
 * which is what Google Input Tools and Keyman do.
 *
 * Used for Amharic and Tigrinya as well as Ge'ez proper; the alphabets differ
 * only in which consonants each language actually uses, so one table serves
 * all three.
 *
 * Unicode: Ethiopic occupies U+1200–U+137F. Each consonant's seven forms sit
 * consecutively from its base, in the order below, so a syllable is just
 * `base + vowelIndex`.
 */

/** Vowel orders, in the order Unicode lays them out after each base. */
export const VOWEL_ORDERS = ["ä", "u", "i", "a", "é", "ə", "o"] as const;

/**
 * Romanisation → base codepoint. Longer spellings are matched first, so "sh"
 * wins over "s" and "ch" over "c".
 *
 * Doubled letters mark the sounds Latin has no separate letter for and which
 * Tigrinya and Ge'ez distinguish — "hh" for ሐ against "h" for ሀ, "ss" for ሠ
 * against "s" for ሰ, and so on. Typing the single form is always safe; the
 * doubles exist for people who want the exact character.
 */
const CONSONANTS: [string, number][] = [
  ["hh", 0x1210], // ሐ
  ["ss", 0x1220], // ሠ
  ["sh", 0x1238], // ሸ
  ["ch", 0x1278], // ቸ
  ["cch", 0x1328], // ጨ
  ["kh", 0x12b0], // ኸ
  ["qh", 0x1250], // ቐ  (Tigrinya)
  ["hx", 0x1280], // ኀ
  ["ny", 0x1298], // ኘ
  ["gn", 0x1298], // ኘ  (common alternative spelling)
  ["zh", 0x12e0], // ዠ
  ["tt", 0x1320], // ጠ
  ["pp", 0x1330], // ጰ
  ["tss", 0x1340], // ፀ
  ["ts", 0x1338], // ጸ
  ["aa", 0x12d0], // ዐ
  ["h", 0x1200], // ሀ
  ["l", 0x1208], // ለ
  ["m", 0x1218], // መ
  ["r", 0x1228], // ረ
  ["s", 0x1230], // ሰ
  ["q", 0x1240], // ቀ
  ["b", 0x1260], // በ
  ["v", 0x1268], // ቨ
  ["t", 0x1270], // ተ
  ["n", 0x1290], // ነ
  ["a", 0x12a0], // አ
  ["k", 0x12a8], // ከ
  ["w", 0x12c8], // ወ
  ["z", 0x12d8], // ዘ
  ["y", 0x12e8], // የ
  ["d", 0x12f0], // ደ
  ["j", 0x1300], // ጀ
  ["g", 0x1308], // ገ
  ["f", 0x1348], // ፈ
  ["p", 0x1350], // ፐ
];

// Longest spelling first, so "tss" is never eaten by "ts" or "t".
const CONSONANT_KEYS = CONSONANTS.map(([k]) => k).sort(
  (a, b) => b.length - a.length
);
const CONSONANT_BASE = new Map(CONSONANTS);

/** Vowel spelling → order index. Again longest-first. */
const VOWELS: [string, number][] = [
  ["ie", 4],
  ["ee", 4],
  ["ea", 4],
  ["e", 0],
  ["u", 1],
  ["oo", 1],
  ["i", 2],
  ["a", 3],
  ["o", 6],
];
const VOWEL_KEYS = VOWELS.map(([k]) => k).sort((a, b) => b.length - a.length);
const VOWEL_ORDER = new Map(VOWELS);

/** A bare vowel with no consonant rides on አ, the glottal series. */
const BARE_VOWEL_BASE = 0x12a0;

/** Order 5 (ə) is what a consonant with no vowel after it becomes. */
const SIXTH_ORDER = 5;

export interface ConsonantFamily {
  /** How you'd type it. */
  key: string;
  /** All seven forms, order 0 through 6. */
  forms: string[];
}

/**
 * Every family, for the on-screen picker — ordered by codepoint, which is the
 * traditional ሀ ለ ሐ መ recitation order anyone who learned the script will be
 * scanning for. The match table above is ordered for parsing, not reading.
 */
export function consonantFamilies(): ConsonantFamily[] {
  const seen = new Set<number>();
  const out: ConsonantFamily[] = [];
  for (const [key, base] of [...CONSONANTS].sort((a, b) => a[1] - b[1])) {
    if (seen.has(base)) continue; // "gn" and "ny" are the same family
    seen.add(base);
    out.push({
      key,
      forms: Array.from({ length: 7 }, (_, i) => String.fromCodePoint(base + i)),
    });
  }
  return out;
}

/** Ethiopic punctuation, offered in the picker rather than auto-substituted. */
export const GEEZ_PUNCTUATION = [
  { char: "፡", name: "word separator" },
  { char: "።", name: "full stop" },
  { char: "፣", name: "comma" },
  { char: "፤", name: "semicolon" },
  { char: "፥", name: "colon" },
  { char: "፦", name: "preface colon" },
  { char: "፧", name: "question mark" },
];

function startsWithAt(text: string, at: number, candidates: string[]) {
  for (const c of candidates) {
    if (text.startsWith(c, at)) return c;
  }
  return null;
}

/**
 * Convert a romanised string to Ethiopic.
 *
 * Deterministic and greedy left to right, which is what makes live conversion
 * safe: re-running it over a growing buffer can only extend or refine what
 * came before, never rewrite it unpredictably. "s" gives ስ, "se" gives ሰ,
 * "sel" gives ሰል, "selam" gives ሰላም.
 *
 * Anything unrecognised — digits, spaces, Latin already-converted text — is
 * passed through untouched.
 */
export function transliterate(latin: string): string {
  const text = latin.toLowerCase();
  let out = "";
  let i = 0;

  while (i < text.length) {
    const consonant = startsWithAt(text, i, CONSONANT_KEYS);

    if (consonant) {
      i += consonant.length;
      const base = CONSONANT_BASE.get(consonant)!;
      const vowel = startsWithAt(text, i, VOWEL_KEYS);
      if (vowel) {
        i += vowel.length;
        out += String.fromCodePoint(base + VOWEL_ORDER.get(vowel)!);
      } else {
        // "a" and "aa" open their own syllable rather than being a consonant
        // awaiting a vowel, so they take the first order (አ, ዐ) instead of
        // being demoted to the sixth. Typing "a" giving anything but አ
        // surprises everyone who has used an Amharic keyboard before.
        out += String.fromCodePoint(
          base + (consonant === "a" || consonant === "aa" ? 0 : SIXTH_ORDER)
        );
      }
      continue;
    }

    const vowel = startsWithAt(text, i, VOWEL_KEYS);
    if (vowel) {
      i += vowel.length;
      out += String.fromCodePoint(BARE_VOWEL_BASE + VOWEL_ORDER.get(vowel)!);
      continue;
    }

    out += latin[i]; // untouched, in its original case
    i += 1;
  }

  return out;
}

/** True if the string contains any Ethiopic character. */
export function hasGeez(text: string): boolean {
  return /[ሀ-፿]/.test(text);
}
