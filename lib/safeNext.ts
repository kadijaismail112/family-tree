/**
 * Validate a `?next=` destination before redirecting to it.
 *
 * The obvious check — "does it start with a slash?" — is not enough.
 * `//evil.com` starts with a slash and is a *protocol-relative URL*: handed to
 * the client router it resolves against the current scheme and navigates
 * straight off the site. `/\evil.com` does the same in several browsers,
 * because they normalise the backslash to a forward one.
 *
 * That makes for a convincing phish: the link really is trydynasty.app, so it
 * earns the click and the sign-in, and only then hands the visitor to someone
 * else's lookalike. Anything that isn't unambiguously a path on this site goes
 * to the fallback instead.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;

  // One leading slash, and the next character must not turn it into a host.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  // Newlines, tabs and other control characters can smuggle a second
  // target past a naive filter, so reject them outright.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  return raw;
}
