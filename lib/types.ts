export type RelationType = "PARENT_OF" | "SPOUSE_OF" | "SIBLING_OF";
export type ConfirmationType = "CONFIRM" | "DISPUTE";

/**
 * Qualifiers on a relationship. Kept as a property of the three core edge
 * types rather than as extra types, so every graph algorithm keeps working
 * while the tree can still say "step-father" or "former partner".
 */
export type ParentKind = "biological" | "adoptive" | "step" | "foster";
export type SpouseKind = "married" | "partner" | "engaged" | "former";
export type SiblingKind = "full" | "half" | "step" | "adoptive";
export type RelationKind = ParentKind | SpouseKind | SiblingKind;

export const PARENT_KINDS: { value: ParentKind; label: string }[] = [
  { value: "biological", label: "Biological parent" },
  { value: "adoptive", label: "Adoptive parent" },
  { value: "step", label: "Step-parent" },
  { value: "foster", label: "Foster parent" },
];
export const SPOUSE_KINDS: { value: SpouseKind; label: string }[] = [
  { value: "married", label: "Married" },
  { value: "partner", label: "Partners" },
  { value: "engaged", label: "Engaged" },
  { value: "former", label: "Former partners" },
];

/**
 * Asked whenever two parents of a child are being recorded: married, partners
 * without a marriage, or not a couple at all. "none" writes no SPOUSE_OF edge.
 */
export type CoupleStatus = "married" | "partner" | "none";
export const SIBLING_KINDS: { value: SiblingKind; label: string }[] = [
  { value: "full", label: "Full siblings" },
  { value: "half", label: "Half siblings" },
  { value: "step", label: "Step siblings" },
  { value: "adoptive", label: "Adoptive siblings" },
];

export function kindsFor(type: RelationType) {
  return type === "PARENT_OF"
    ? PARENT_KINDS
    : type === "SPOUSE_OF"
      ? SPOUSE_KINDS
      : SIBLING_KINDS;
}
export function defaultKind(type: RelationType): RelationKind {
  return type === "PARENT_OF" ? "biological" : type === "SPOUSE_OF" ? "married" : "full";
}
/** step and foster ties are family, but they do not carry a bloodline */
export function isLineageKind(kind: RelationKind | undefined) {
  return kind === undefined || kind === "biological" || kind === "adoptive";
}
/**
 * Siblings have their own vocabulary — "full" and "half" where a parent
 * would say "biological" — so the parent predicate above answers "no
 * bloodline" for every sibling link the UI actually writes. They need their
 * own answer: only a step-sibling arrives without shared blood.
 */
export function isLineageSiblingKind(kind: RelationKind | undefined) {
  return (
    kind === undefined || kind === "full" || kind === "half" || kind === "adoptive"
  );
}
/**
 * Does this edge carry a bloodline? The kind alone can't say — "adoptive"
 * means one thing on a parent and another on a sibling — so the type has to
 * come with it.
 */
export function carriesLineage(
  type: RelationType,
  kind: RelationKind | undefined
) {
  if (type === "PARENT_OF") return isLineageKind(kind);
  if (type === "SIBLING_OF") return isLineageSiblingKind(kind);
  return false;
}

/** Only ever used to choose the right word — never guessed from a name. */
export type Gender = "female" | "male" | "other";

/** Explicit, because "no death date" and "still alive" are not the same. */
export type LifeStatus = "living" | "deceased";

/**
 * Family-confirmed answer to "did they marry in, or are they blood?"
 * Unset means the tree still decides from connections.
 */
export type Lineage = "blood" | "married_in";

/** Who changed what, so the provenance trail survives editing. */
export interface EditRecord {
  id: string;
  familyId: string;
  entity: "person" | "relationship";
  entityId: string;
  /** human-readable label of what changed, e.g. "Birth year" */
  field: string;
  from: string;
  to: string;
  userId: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  color: string; // avatar hue
}

export interface Family {
  id: string;
  name: string;
  createdAt: string;
  /** the one member who can remove others — the lightest possible moderation */
  createdById?: string;
}

export interface Membership {
  id: string;
  userId: string;
  familyId: string;
  joinedAt: string;
}

export interface Invite {
  id: string;
  code: string;
  familyId: string;
  createdById: string;
  createdAt: string;
}

// Optional freeform detail fields — only rendered when filled in.
export type DetailKey =
  | "currentCity"
  | "birthCity"
  | "funnyStories"
  | "phone"
  | "email"
  | "currentAddress"
  | "travelPlans"
  | "college"
  | "jobs"
  | "clusterGroup"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "otherSocial";

export interface DetailFieldDef {
  key: DetailKey;
  label: string;
  // "city" renders a place picker rather than a bare text box, so the user
  // can see whether what they typed will actually land on the map.
  kind: "text" | "textarea" | "date" | "tel" | "email" | "url" | "city";
  placeholder?: string;
}

export const PERSON_DETAIL_FIELDS: DetailFieldDef[] = [
  { key: "currentCity", label: "Current city", kind: "city", placeholder: "Start typing a city or town…" },
  { key: "birthCity", label: "Birth city", kind: "city", placeholder: "Start typing a city or town…" },
  { key: "funnyStories", label: "Funny stories", kind: "textarea", placeholder: "The one everyone tells at dinner…" },
  { key: "phone", label: "Phone number", kind: "tel", placeholder: "+1 (555) 010-0000" },
  { key: "email", label: "Email", kind: "email", placeholder: "name@example.com" },
  { key: "currentAddress", label: "Current address", kind: "text", placeholder: "Street, city, country" },
  { key: "travelPlans", label: "Upcoming travel plans", kind: "textarea", placeholder: "Visiting the cousins in August…" },
  { key: "college", label: "College", kind: "text", placeholder: "School & years" },
  { key: "jobs", label: "Jobs", kind: "textarea", placeholder: "What they do / did" },
  { key: "clusterGroup", label: "Cluster", kind: "text", placeholder: "A named group in this family" },
  { key: "linkedin", label: "LinkedIn", kind: "url", placeholder: "https://linkedin.com/in/…" },
  { key: "facebook", label: "Facebook", kind: "url", placeholder: "https://facebook.com/…" },
  { key: "instagram", label: "Instagram", kind: "url", placeholder: "https://instagram.com/…" },
  { key: "otherSocial", label: "Other link", kind: "url", placeholder: "https://…" },
];

// A photo attached to a person's node. Tagged people also see it under
// their own node.
export interface PersonPhoto {
  id: string;
  personId: string; // the node it was uploaded to
  familyId: string;
  dataUrl: string;
  caption?: string;
  taggedPersonIds: string[];
  addedById: string;
  createdAt: string;
}

export interface PersonComment {
  id: string;
  personId: string;
  familyId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Person {
  id: string;
  familyId: string;
  name: string;
  /**
   * Years are what most people know; the full ISO dates are optional and
   * take precedence for display. `birthYear` is always kept in step with
   * `birthDate` so there is one answer to "when were they born".
   */
  birthYear?: string;
  deathYear?: string;
  birthDate?: string;
  deathDate?: string;
  lifeStatus?: LifeStatus;
  gender?: Gender;
  /** a real portrait — shown beside the name only when one has been added */
  photoUrl?: string;
  notes?: string;
  details?: Partial<Record<DetailKey, string>>;
  /** When set, node colour and the sheet chip follow this instead of kinship. */
  lineage?: Lineage;
  voiceNameUrl?: string; // recorded pronunciation of their name
  accountUserId?: string; // set when this person has claimed their node
  addedById: string; // provenance — never editable
  createdAt: string;
}

export interface Relationship {
  id: string;
  familyId: string;
  fromPersonId: string;
  toPersonId: string;
  type: RelationType;
  kind?: RelationKind;
  addedById: string; // provenance
  createdAt: string;
}

export interface Confirmation {
  id: string;
  relationshipId: string;
  userId: string;
  type: ConfirmationType;
  createdAt: string;
}

export interface Store {
  users: User[];
  families: Family[];
  memberships: Membership[];
  invites: Invite[];
  people: Person[];
  relationships: Relationship[];
  confirmations: Confirmation[];
  photos: PersonPhoto[];
  comments: PersonComment[];
  edits: EditRecord[];
  // "parentId>childId" keys for assumed-parent suggestions a member denied
  dismissedSuggestions: string[];
}

export const RELATION_LABEL: Record<RelationType, string> = {
  PARENT_OF: "parent of",
  SPOUSE_OF: "spouse of",
  SIBLING_OF: "sibling of",
};
