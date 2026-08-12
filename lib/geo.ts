import type { Person } from "./types";

/**
 * People type their city as free text, so placing them on a globe needs a
 * lookup. This is a built-in gazetteer rather than a geocoding API call —
 * it works offline and keeps family addresses from leaving the device.
 * Anything unmatched is surfaced to the user rather than silently dropped.
 */
export interface City {
  name: string;
  lat: number;
  lon: number;
}

const GAZETTEER: Record<string, City> = {};

function add(name: string, lat: number, lon: number, ...aliases: string[]) {
  const city = { name, lat, lon };
  [name, ...aliases].forEach((a) => {
    GAZETTEER[normalise(a)] = city;
  });
}

export function normalise(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Africa & Middle East ─────────────────────────────────────────────
add("Asmara", 15.3229, 38.9251);
add("Adi Keyh", 14.8442, 39.3767);
add("Keren", 15.7778, 38.4511);
add("Massawa", 15.6089, 39.4497);
add("Addis Ababa", 9.032, 38.7469);
add("Mekelle", 13.4967, 39.4753);
add("Khartoum", 15.5007, 32.5599);
add("Cairo", 30.0444, 31.2357);
add("Nairobi", -1.2864, 36.8172);
add("Kampala", 0.3476, 32.5825);
add("Dar es Salaam", -6.7924, 39.2083);
add("Lagos", 6.5244, 3.3792);
add("Abuja", 9.0765, 7.3986);
add("Accra", 5.6037, -0.187);
add("Dakar", 14.7167, -17.4677);
add("Casablanca", 33.5731, -7.5898);
add("Johannesburg", -26.2041, 28.0473);
add("Cape Town", -33.9249, 18.4241);
add("Tel Aviv", 32.0853, 34.7818);
add("Jerusalem", 31.7683, 35.2137);
add("Dubai", 25.2048, 55.2708);
add("Doha", 25.2854, 51.531);
add("Riyadh", 24.7136, 46.6753);
add("Jeddah", 21.4858, 39.1925);
add("Istanbul", 41.0082, 28.9784);
add("Beirut", 33.8938, 35.5018);
add("Amman", 31.9454, 35.9284);
add("Baghdad", 33.3152, 44.3661);
add("Tehran", 35.6892, 51.389);

// ── Europe ───────────────────────────────────────────────────────────
add("London", 51.5074, -0.1278);
add("Manchester", 53.4808, -2.2426);
add("Birmingham", 52.4862, -1.8904);
add("Edinburgh", 55.9533, -3.1883);
add("Dublin", 53.3498, -6.2603);
add("Paris", 48.8566, 2.3522);
add("Lyon", 45.764, 4.8357);
add("Marseille", 43.2965, 5.3698);
add("Frankfurt", 50.1109, 8.6821, "Frankfurt am Main");
add("Berlin", 52.52, 13.405);
add("Munich", 48.1351, 11.582, "Muenchen", "Munchen");
add("Hamburg", 53.5511, 9.9937);
add("Cologne", 50.9375, 6.9603, "Koln", "Koeln");
add("Stuttgart", 48.7758, 9.1829);
add("Amsterdam", 52.3676, 4.9041);
add("Rotterdam", 51.9244, 4.4777);
add("Brussels", 50.8503, 4.3517);
add("Zurich", 47.3769, 8.5417);
add("Geneva", 46.2044, 6.1432);
add("Vienna", 48.2082, 16.3738);
add("Rome", 41.9028, 12.4964);
add("Milan", 45.4642, 9.19);
add("Madrid", 40.4168, -3.7038);
add("Barcelona", 41.3874, 2.1686);
add("Lisbon", 38.7223, -9.1393);
add("Stockholm", 59.3293, 18.0686);
add("Oslo", 59.9139, 10.7522);
add("Copenhagen", 55.6761, 12.5683);
add("Helsinki", 60.1699, 24.9384);
add("Warsaw", 52.2297, 21.0122);
add("Prague", 50.0755, 14.4378);
add("Budapest", 47.4979, 19.0402);
add("Athens", 37.9838, 23.7275);
add("Bucharest", 44.4268, 26.1025);
add("Kyiv", 50.4501, 30.5234, "Kiev");
add("Moscow", 55.7558, 37.6173);

// ── North America ────────────────────────────────────────────────────
add("San Diego", 32.7157, -117.1611);
add("Los Angeles", 34.0522, -118.2437);
add("Oakland", 37.8044, -122.2712);
add("San Francisco", 37.7749, -122.4194);
add("San Jose", 37.3382, -121.8863);
add("Sacramento", 38.5816, -121.4944);
add("Seattle", 47.6062, -122.3321);
add("Portland", 45.5152, -122.6784);
add("Las Vegas", 36.1699, -115.1398);
add("Phoenix", 33.4484, -112.074);
add("Denver", 39.7392, -104.9903);
add("Salt Lake City", 40.7608, -111.891);
add("Austin", 30.2672, -97.7431);
add("Dallas", 32.7767, -96.797);
add("Houston", 29.7604, -95.3698);
add("San Antonio", 29.4241, -98.4936);
add("Chicago", 41.8781, -87.6298);
add("Detroit", 42.3314, -83.0458);
add("Minneapolis", 44.9778, -93.265);
add("Columbus", 39.9612, -82.9988);
add("Nashville", 36.1627, -86.7816);
add("Atlanta", 33.749, -84.388);
add("Miami", 25.7617, -80.1918);
add("Orlando", 28.5383, -81.3792);
add("Charlotte", 35.2271, -80.8431);
add("Washington", 38.9072, -77.0369, "Washington DC", "DC");
add("Baltimore", 39.2904, -76.6122);
add("Philadelphia", 39.9526, -75.1652);
add("New York", 40.7128, -74.006, "NYC", "New York City", "Brooklyn", "Manhattan", "Queens");
add("Boston", 42.3601, -71.0589);
add("Toronto", 43.6532, -79.3832);
add("Ottawa", 45.4215, -75.6972);
add("Montreal", 45.5017, -73.5673);
add("Vancouver", 49.2827, -123.1207);
add("Calgary", 51.0447, -114.0719);
add("Edmonton", 53.5461, -113.4938);
add("Winnipeg", 49.8951, -97.1384);
add("Mexico City", 19.4326, -99.1332, "Ciudad de Mexico", "CDMX");
add("Guadalajara", 20.6597, -103.3496);
add("Monterrey", 25.6866, -100.3161);
add("Antigua Guatemala", 14.5586, -90.7295, "Antigua");
add("Guatemala City", 14.6349, -90.5069, "Ciudad de Guatemala");
add("Quetzaltenango", 14.8347, -91.518, "Xela");
add("San Salvador", 13.6929, -89.2182);
add("Tegucigalpa", 14.0723, -87.1921);
add("Havana", 23.1136, -82.3666, "La Habana");
add("Santo Domingo", 18.4861, -69.9312);
add("San Juan", 18.4655, -66.1057);
add("Kingston", 17.9714, -76.7936);

// ── South America ────────────────────────────────────────────────────
add("Bogota", 4.711, -74.0721);
add("Medellin", 6.2442, -75.5812);
add("Caracas", 10.4806, -66.9036);
add("Quito", -0.1807, -78.4678);
add("Lima", -12.0464, -77.0428);
add("La Paz", -16.4897, -68.1193);
add("Santiago", -33.4489, -70.6693);
add("Buenos Aires", -34.6037, -58.3816);
add("Montevideo", -34.9011, -56.1645);
add("Sao Paulo", -23.5505, -46.6333);
add("Rio de Janeiro", -22.9068, -43.1729);
add("Brasilia", -15.7939, -47.8828);

// ── Asia & Oceania ───────────────────────────────────────────────────
add("Tokyo", 35.6762, 139.6503);
add("Osaka", 34.6937, 135.5023);
add("Seoul", 37.5665, 126.978);
add("Beijing", 39.9042, 116.4074);
add("Shanghai", 31.2304, 121.4737);
add("Hong Kong", 22.3193, 114.1694);
add("Taipei", 25.033, 121.5654);
add("Singapore", 1.3521, 103.8198);
add("Bangkok", 13.7563, 100.5018);
add("Jakarta", -6.2088, 106.8456);
add("Manila", 14.5995, 120.9842);
add("Hanoi", 21.0278, 105.8342);
add("Ho Chi Minh City", 10.8231, 106.6297, "Saigon");
add("Kuala Lumpur", 3.139, 101.6869);
add("Delhi", 28.7041, 77.1025, "New Delhi");
add("Mumbai", 19.076, 72.8777, "Bombay");
add("Bangalore", 12.9716, 77.5946, "Bengaluru");
add("Chennai", 13.0827, 80.2707);
add("Hyderabad", 17.385, 78.4867);
add("Kolkata", 22.5726, 88.3639, "Calcutta");
add("Karachi", 24.8607, 67.0011);
add("Lahore", 31.5204, 74.3587);
add("Islamabad", 33.6844, 73.0479);
add("Dhaka", 23.8103, 90.4125);
add("Kathmandu", 27.7172, 85.324);
add("Colombo", 6.9271, 79.8612);
add("Sydney", -33.8688, 151.2093);
add("Melbourne", -37.8136, 144.9631);
add("Brisbane", -27.4698, 153.0251);
add("Perth", -31.9505, 115.8605);
add("Auckland", -36.8485, 174.7633);
add("Wellington", -41.2865, 174.7762);

/** Best-effort match of a free-text city to a known place. */
export function lookupCity(raw: string): City | null {
  const full = normalise(raw);
  if (GAZETTEER[full]) return GAZETTEER[full];
  // "San Diego, CA" / "Frankfurt, Germany" — try the part before the comma
  const head = normalise(raw.split(",")[0]);
  if (GAZETTEER[head]) return GAZETTEER[head];
  return null;
}

export interface CityGroup {
  city: City;
  people: Person[];
}

/** Group a family's living locations into placeable points plus leftovers. */
export function groupByCity(people: Person[]): {
  groups: CityGroup[];
  unplaced: { label: string; people: Person[] }[];
  without: number;
} {
  const byKey = new Map<string, CityGroup>();
  const unknown = new Map<string, { label: string; people: Person[] }>();
  let without = 0;

  for (const person of people) {
    const raw = person.details?.currentCity;
    if (!raw?.trim()) {
      without++;
      continue;
    }
    const city = lookupCity(raw);
    if (city) {
      const key = `${city.lat},${city.lon}`;
      if (!byKey.has(key)) byKey.set(key, { city, people: [] });
      byKey.get(key)!.people.push(person);
    } else {
      const key = normalise(raw);
      if (!unknown.has(key)) unknown.set(key, { label: raw.trim(), people: [] });
      unknown.get(key)!.people.push(person);
    }
  }

  return {
    groups: Array.from(byKey.values()).sort((a, b) => b.people.length - a.people.length),
    unplaced: Array.from(unknown.values()).sort((a, b) => b.people.length - a.people.length),
    without,
  };
}
