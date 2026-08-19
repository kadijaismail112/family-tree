import type { MetadataRoute } from "next";

// The landing page is the only public surface worth finding in a search engine.
// Everything else is either behind auth or a private link (invite codes,
// family trees), so it is kept out of the index. Note this is a crawler
// convention, not a security boundary — access is enforced by Supabase RLS and
// the auth middleware.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/family/",
        "/join/",
        "/login",
        "/signup",
        "/forgot-password",
      ],
    },
    host: "https://www.trydynasty.app",
  };
}
