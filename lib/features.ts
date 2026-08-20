/**
 * Feature switches for things that are built but deliberately not on.
 *
 * Kept as plain constants rather than env vars so the state is visible in the
 * diff and in review, and so turning something back on is a one-line change
 * with history attached.
 */

/**
 * The per-person photo gallery — many photos per person, each with a caption
 * and tagged relatives.
 *
 * Suspended for launch. It is the only unbounded upload path in the product:
 * one member could add photos indefinitely, and there is no per-family quota,
 * no moderation and no abuse reporting to catch it. Profile pictures are
 * unaffected — those are capped at one per person by their own shape.
 *
 * Existing galleries stay readable and removable; this only closes the door to
 * new uploads. Set to true to restore the feature.
 */
export const GALLERY_PHOTOS_ENABLED = false;
