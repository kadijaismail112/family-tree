/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The gazetteer is ~2.5MB and changes only when it is regenerated.
        // Vercel's default for public/ is `max-age=0, must-revalidate`, which
        // costs a round trip on every single visit.
        //
        // Deliberately not `immutable`: the filename carries no content hash,
        // so an immutable response would strand every browser on a stale copy
        // after a regeneration. stale-while-revalidate removes the round trip
        // while still letting a new build propagate within a day.
        source: "/gazetteer.tsv",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
