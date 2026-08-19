"""Regenerate public/gazetteer.tsv from the GeoNames cities500 dump.

Run from a directory holding the three GeoNames files, then copy the result
into public/:

    curl -O https://download.geonames.org/export/dump/cities500.zip
    curl -O https://download.geonames.org/export/dump/countryInfo.txt
    curl -O https://download.geonames.org/export/dump/admin1CodesASCII.txt
    unzip cities500.zip
    python3 build-gazetteer.py
    cp gazetteer.tsv ../public/

Source data is GeoNames, CC BY 4.0 — the attribution in the place picker is
a licence condition, not decoration.


1. Common English aliases are carried for larger places, so "New York",
   "Frankfurt" and "Bangalore" resolve — GeoNames stores those as
   "New York City", "Frankfurt am Main" and "Bengaluru".
2. Population is bucketed at ~4.5 steps per decade instead of one, so
   Cologne (963k) can outrank Cologne, Lombardy (7k). At one bucket per
   decade they tied and the winner was decided by country name.

Columns: name, lat, lon, regionIdx, countryIdx, popBucket, aliases
"""
import math
import unicodedata

B36 = "0123456789abcdefghijklmnopqrstuvwxyz"
ALIAS_MIN_POP = 100_000  # only larger places carry aliases, to bound size
MAX_ALIASES = 10


def enc(n):
    if n == 0:
        return "0"
    out = ""
    while n:
        out = B36[n % 36] + out
        n //= 36
    return out


def normalise(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join("".join(c if c.isalnum() else " " for c in s.lower()).split())


cc_names = {}
with open("countryInfo.txt", encoding="utf-8") as fh:
    for line in fh:
        if not line.startswith("#"):
            f = line.rstrip("\n").split("\t")
            if len(f) > 4 and f[0]:
                cc_names[f[0]] = f[4]

a1_names = {}
with open("admin1CodesASCII.txt", encoding="utf-8") as fh:
    for line in fh:
        f = line.rstrip("\n").split("\t")
        if len(f) >= 2:
            a1_names[f[0]] = f[1]

rows = []
with open("cities500.txt", encoding="utf-8") as fh:
    for line in fh:
        f = line.rstrip("\n").split("\t")
        if len(f) < 15 or not f[1] or not f[4]:
            continue
        name, ascii_name, alt = f[1], f[2], f[3]
        key = normalise(name)
        if not key:
            continue
        try:
            lat, lon = round(float(f[4]), 2), round(float(f[5]), 2)
            pop = int(f[14]) if f[14] else 0
        except ValueError:
            continue

        country = cc_names.get(f[8], f[8])
        region = a1_names.get(f"{f[8]}.{f[10]}", "") if f[10] else ""
        if normalise(region) == key:
            region = ""

        # ~4.5 buckets per decade keeps a 1-char field but stops a 7k-person
        # village from tying with a 963k-person city.
        bucket = 0 if pop <= 0 else min(35, round(math.log10(pop) * 4.5))

        aliases = []
        seen = {key}
        if normalise(ascii_name) not in seen:
            aliases.append(ascii_name)
            seen.add(normalise(ascii_name))
        if pop >= ALIAS_MIN_POP and alt:
            for cand in alt.split(","):
                if len(aliases) >= MAX_ALIASES:
                    break
                cand = cand.strip()
                # plain ASCII only: skips the script variants and the
                # language-tagged junk that make this column enormous
                if not cand or not cand.isascii() or not cand[0].isalpha():
                    continue
                nk = normalise(cand)
                if not nk or nk in seen or len(nk) > 40:
                    continue
                aliases.append(cand)
                seen.add(nk)

        rows.append((country, region, name, lat, lon, bucket, aliases))

rows.sort(key=lambda r: (r[0], r[1], r[2]))

countries, regions = {}, {}


def intern(table, value):
    if value not in table:
        table[value] = len(table)
    return table[value]


body = []
for country, region, name, lat, lon, bucket, aliases in rows:
    ri = enc(intern(regions, region))
    ci = enc(intern(countries, country))
    body.append(
        f"{name}\t{lat}\t{lon}\t{ri}\t{ci}\t{B36[bucket]}\t{'|'.join(aliases)}"
    )

header = "\x1e".join(countries) + "\x1d" + "\x1e".join(regions)
with open("gazetteer.tsv", "w", encoding="utf-8") as fh:
    fh.write(header + "\n" + "\n".join(body) + "\n")

n_alias = sum(len(r[6]) for r in rows)
print(f"wrote gazetteer.tsv: {len(rows)} places, {n_alias} alias keys, "
      f"{len(regions)} regions, {len(countries)} countries")
