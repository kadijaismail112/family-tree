import { lookupCity, normalise, type City } from "./geo";

/**
 * The full gazetteer: every populated place GeoNames lists with 500+ people.
 *
 * It is deliberately a static file fetched from our own origin rather than a
 * geocoding API, so a family member's typed location never reaches a third
 * party. It is ~2.5MB over the wire, so it loads lazily — only once someone
 * actually edits a place field — and the browser caches it from then on.
 *
 * The curated list in geo.ts still wins any name it knows. GeoNames stores
 * official names, so "New York" is filed under "New York City" and "Bangalore"
 * under "Bengaluru"; it also has a Cologne in Lombardy and a San Juan in
 * Argentina that would otherwise outrank the ones people mean. Curated-first
 * keeps those answers stable and makes this file purely additive.
 *
 * Data: GeoNames (https://geonames.org), CC BY 4.0.
 */

export interface Place extends City {
  /** "Adi Keyh, Debub, Eritrea" — what the picker shows. */
  label: string;
  region: string;
  country: string;
  /** ~4.5 steps per population decade, for ranking only. */
  scale: number;
}

export interface Gazetteer {
  places: Place[];
  /** Every search key joined by \n, so a query is one native indexOf sweep. */
  blob: string;
  /** blob offset where each key begins, ascending. */
  offsets: Int32Array;
  /** Place index each key belongs to — a place can have several keys. */
  owner: Int32Array;
  /** 1 when the key is the place's own name rather than an alias. */
  primary: Uint8Array;
}

let loading: Promise<Gazetteer> | null = null;

/** Exported for tests; callers should use `loadGazetteer`. */
export function parseGazetteer(text: string): Gazetteer {
  const newline = text.indexOf("\n");
  const [countryPart, regionPart] = text.slice(0, newline).split("\x1d");
  const countries = countryPart.split("\x1e");
  const regions = regionPart.split("\x1e");

  const places: Place[] = [];
  const keys: string[] = [];
  const owners: number[] = [];
  const primaries: number[] = [];

  let cursor = newline + 1;
  const end = text.length;
  while (cursor < end) {
    let stop = text.indexOf("\n", cursor);
    if (stop === -1) stop = end;
    const line = text.slice(cursor, stop);
    cursor = stop + 1;
    if (!line) continue;

    const f = line.split("\t");
    if (f.length < 6) continue;
    const name = f[0];
    const region = regions[parseInt(f[3], 36)] ?? "";
    const country = countries[parseInt(f[4], 36)] ?? "";
    const index = places.length;

    places.push({
      name,
      lat: +f[1],
      lon: +f[2],
      region,
      country,
      scale: parseInt(f[5], 36) || 0,
      label: [name, region, country].filter(Boolean).join(", "),
    });

    const seen = new Set<string>();
    const candidates = [name, ...(f[6] ? f[6].split("|") : [])];
    for (let c = 0; c < candidates.length; c++) {
      const key = normalise(candidates[c]);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
      owners.push(index);
      primaries.push(c === 0 ? 1 : 0);
    }
  }

  const offsets = new Int32Array(keys.length);
  let at = 1; // leading \n, so "\n" + query only ever matches a key start
  for (let i = 0; i < keys.length; i++) {
    offsets[i] = at;
    at += keys[i].length + 1;
  }

  return {
    places,
    blob: `\n${keys.join("\n")}\n`,
    offsets,
    owner: Int32Array.from(owners),
    primary: Uint8Array.from(primaries),
  };
}

/** Fetch and index the gazetteer. Safe to call repeatedly; work happens once. */
export function loadGazetteer(): Promise<Gazetteer> {
  if (!loading) {
    loading = fetch("/gazetteer.tsv")
      .then((res) => {
        if (!res.ok) throw new Error(`gazetteer ${res.status}`);
        return res.text();
      })
      .then(parseGazetteer)
      .catch((err) => {
        loading = null; // let a later attempt retry rather than cache failure
        throw err;
      });
  }
  return loading;
}

/** Index of the key owning a blob offset. */
function keyAt(offsets: Int32Array, offset: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] === offset) return mid;
    if (offsets[mid] < offset) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export interface Suggestion {
  place: Place;
  /** True when the query matched a whole name, not just its start. */
  exact: boolean;
}

/**
 * Rank places matching `query`: whole-name matches first, then larger places,
 * then shorter names — so "san fran" leads with San Francisco rather than
 * San Francisco de Macorís.
 */
export function searchPlaces(
  data: Gazetteer,
  query: string,
  limit = 8
): Suggestion[] {
  const q = normalise(query);
  if (q.length < 2) return [];

  const hits: { index: number; exact: boolean; primary: boolean }[] = [];
  const seen = new Set<number>();
  const needle = `\n${q}`;

  let from = 0;
  // Cap the sweep: a very common prefix would otherwise walk the whole blob.
  while (hits.length < 400) {
    const found = data.blob.indexOf(needle, from);
    if (found === -1) break;
    from = found + 1;
    const key = keyAt(data.offsets, found + 1);
    if (key === -1) continue;
    const index = data.owner[key];
    if (seen.has(index)) continue;
    seen.add(index);
    hits.push({
      index,
      exact: data.blob.charCodeAt(found + needle.length) === 10 /* \n */,
      primary: data.primary[key] === 1,
    });
  }

  hits.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    // A place's own name beats an alias, or "san fran" leads with Quito —
    // whose alternate names include "San Francisco de Quito".
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    const pa = data.places[a.index];
    const pb = data.places[b.index];
    if (pb.scale !== pa.scale) return pb.scale - pa.scale;
    return pa.name.length - pb.name.length;
  });

  return hits
    .slice(0, limit)
    .map(({ index, exact }) => ({ place: data.places[index], exact }));
}

function fromCurated(city: City): Place {
  return {
    ...city,
    label: city.name,
    region: "",
    country: "",
    scale: 99, // curated entries outrank anything from the bulk file
  };
}

/**
 * Resolve free text to a place. The curated list answers first, then an exact
 * gazetteer match, then a place whose name merely starts with the query —
 * which is what lets "Frankfurt" find "Frankfurt am Main".
 */
export function resolvePlace(data: Gazetteer, raw: string): Place | null {
  const curated = lookupCity(raw);
  if (curated) return fromCurated(curated);

  const head = raw.split(",")[0];
  for (const candidate of [raw, head]) {
    if (!candidate.trim()) continue;
    const matches = searchPlaces(data, candidate, 50);
    const exact = matches.find((m) => m.exact);
    if (exact) return exact.place;
  }
  // Fall back to a prefix match only on a reasonably specific query.
  const head2 = normalise(head);
  if (head2.length >= 4) {
    const prefix = searchPlaces(data, head, 1)[0];
    if (prefix) return prefix.place;
  }
  return null;
}
