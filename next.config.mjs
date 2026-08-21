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
      {
        // Only HSTS was being sent. These cost nothing and close the cheap
        // attacks that don't need a bug in the app to work.
        source: "/:path*",
        headers: [
          {
            // Nothing here should ever be framed. An invite page or a tree
            // inside someone else's iframe is a clickjacking setup, and this
            // app has one-click destructive actions in it.
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Stops a browser deciding an uploaded file is HTML and running
            // it. Uploads are MIME-restricted at the bucket, but this is the
            // layer that doesn't depend on that being right.
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Invite tokens live in the URL path. Modern browsers already
            // default to this, but stating it means the token can never ride
            // out in a Referer header to somewhere else.
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Microphone stays available to this origin — recording how a
            // name is pronounced needs it. Everything else is off.
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
