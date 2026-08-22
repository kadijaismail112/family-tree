/**
 * Versions of the published policies.
 *
 * Consent is recorded against these, so "they agreed" is always "they agreed
 * to this text". Without a version, revising a policy silently reinterprets
 * every consent already given — the person accepted words they never saw.
 *
 * The date shown at the top of each policy page comes from here too, so what
 * a reader sees and what gets recorded cannot drift apart.
 *
 * Bump the version when the substance changes, not for typos. Existing users
 * keep their record against the version they actually accepted; asking them to
 * re-consent is then a deliberate decision rather than something that happened
 * by accident.
 */

export const TERMS_VERSION = "2026-08-20";
export const PRIVACY_VERSION = "2026-08-20";

/** How the date is written on the policy pages. */
export function formatVersion(version: string): string {
  return new Date(`${version}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The pair a signup or invite acceptance agrees to, in one place. */
export const CURRENT_CONSENT = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
} as const;
