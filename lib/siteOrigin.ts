/**
 * The origin to put in an emailed link.
 *
 * Supabase only honours a redirect that matches its allow-list; anything else
 * is silently swapped for the project's Site URL, which drops both the
 * /auth/callback path and the ?next= riding on it. The person then gets an
 * email whose link lands on the homepage and confirms nothing.
 *
 * Using window.location.origin makes that depend on which hostname the
 * browser happened to be on. This project's allow-list has the www form and
 * not the bare one, so anybody who reached the app on the bare domain would
 * send themselves a dead link. A redirect at the edge hides that today, which
 * makes it a trap rather than a bug: it breaks the moment that redirect
 * changes, and it breaks silently.
 *
 * Set NEXT_PUBLIC_SITE_URL to the canonical origin and every email points at
 * the allow-listed one no matter where the person is standing. Unset — as in
 * local development — it falls back to the current origin, which is what
 * localhost needs.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** An absolute link back into this site, for Supabase to email out. */
export function emailReturnUrl(path: string): string {
  return `${siteOrigin()}${path}`;
}
