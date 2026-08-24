import type { Database, Json } from "@/lib/database.types";
import { colorFor } from "@/lib/helpers";
import type {
  Confirmation,
  ConfirmationType,
  DetailKey,
  EditRecord,
  Family,
  Gender,
  Invite,
  LifeStatus,
  Lineage,
  Membership,
  Person,
  PersonComment,
  PersonPhoto,
  RelationKind,
  RelationType,
  Relationship,
  User,
} from "@/lib/types";

type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type RelRow = Database["public"]["Tables"]["relationships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type FamilyRow = Database["public"]["Tables"]["families"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
type InviteRow = Database["public"]["Tables"]["invites"]["Row"];
type ConfirmationRow = Database["public"]["Tables"]["confirmations"]["Row"];
type PhotoRow = Database["public"]["Tables"]["photos"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
type EditRow = Database["public"]["Tables"]["edits"]["Row"];

export function toDbRelationType(
  t: RelationType
): Database["public"]["Enums"]["relation_type"] {
  return t.toLowerCase() as Database["public"]["Enums"]["relation_type"];
}

export function fromDbRelationType(
  t: Database["public"]["Enums"]["relation_type"]
): RelationType {
  return t.toUpperCase() as RelationType;
}

export function toDbConfirmation(
  t: ConfirmationType
): Database["public"]["Enums"]["confirmation_type"] {
  return t.toLowerCase() as Database["public"]["Enums"]["confirmation_type"];
}

export function yearToDb(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const n = parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export function yearFromDb(value: number | null): string | undefined {
  return value == null ? undefined : String(value);
}

export function emptyToNull(value?: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export function mapUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email ?? "",
    color: colorFor(row.id),
  };
}

export function mapFamily(row: FamilyRow): Family {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    createdById: row.created_by ?? undefined,
  };
}

export function mapMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    joinedAt: row.joined_at,
  };
}

export function mapInvite(row: InviteRow): Invite {
  return {
    id: row.id,
    code: row.code,
    familyId: row.family_id,
    createdById: row.created_by ?? "",
    createdAt: row.created_at,
  };
}

function asDetails(value: Json): Person["details"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Partial<Record<DetailKey, string>> = {};
  for (const [k, v] of Object.entries(value)) {
    // Reserved keys (lineage override) stay off the "Add info" list.
    if (k.startsWith("_")) continue;
    if (typeof v === "string") out[k as DetailKey] = v;
  }
  return out;
}

function lineageFromDetails(value: Json): Lineage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = (value as Record<string, unknown>)._lineage;
  return v === "blood" || v === "married_in" ? v : undefined;
}

/** Writes public detail fields plus the reserved lineage override. */
export function detailsPayload(
  details: Person["details"],
  lineage?: Lineage | null
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    if (v) out[k] = v;
  }
  if (lineage === "blood" || lineage === "married_in") out._lineage = lineage;
  return out;
}

export function mapPerson(
  row: PersonRow,
  urls: Map<string, string>
): Person {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    birthYear: yearFromDb(row.birth_year),
    deathYear: yearFromDb(row.death_year),
    birthDate: row.birth_date ?? undefined,
    deathDate: row.death_date ?? undefined,
    lifeStatus: (row.life_status as LifeStatus | null) ?? undefined,
    gender: (row.gender as Gender | null) ?? undefined,
    photoUrl: row.photo_path ? urls.get(row.photo_path) : undefined,
    notes: row.notes ?? undefined,
    details: asDetails(row.details),
    lineage: lineageFromDetails(row.details),
    voiceNameUrl: row.voice_name_path
      ? urls.get(row.voice_name_path)
      : undefined,
    accountUserId: row.account_user_id ?? undefined,
    addedById: row.added_by ?? "",
    createdAt: row.created_at,
  };
}

export function mapRelationship(row: RelRow): Relationship {
  return {
    id: row.id,
    familyId: row.family_id,
    fromPersonId: row.from_person_id,
    toPersonId: row.to_person_id,
    type: fromDbRelationType(row.type),
    kind: (row.kind as RelationKind | null) ?? undefined,
    addedById: row.added_by ?? "",
    createdAt: row.created_at,
  };
}

export function mapConfirmation(row: ConfirmationRow): Confirmation {
  return {
    id: row.id,
    relationshipId: row.relationship_id,
    userId: row.user_id,
    type: row.type.toUpperCase() as ConfirmationType,
    createdAt: row.created_at,
  };
}

export function mapPhoto(
  row: PhotoRow,
  taggedPersonIds: string[],
  urls: Map<string, string>
): PersonPhoto {
  return {
    id: row.id,
    personId: row.person_id,
    familyId: row.family_id,
    dataUrl: urls.get(row.storage_path) ?? "",
    caption: row.caption ?? undefined,
    taggedPersonIds,
    addedById: row.added_by ?? "",
    createdAt: row.created_at,
  };
}

export function mapComment(row: CommentRow): PersonComment {
  return {
    id: row.id,
    personId: row.person_id,
    familyId: row.family_id,
    userId: row.user_id ?? "",
    text: row.body,
    createdAt: row.created_at,
  };
}

export function mapEdit(row: EditRow): EditRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    entity: row.entity,
    entityId: row.entity_id,
    field: row.field,
    from: row.old_value ?? "",
    to: row.new_value ?? "",
    userId: row.user_id ?? "",
    createdAt: row.created_at,
  };
}

// Postgres names the constraint that stopped the write, which is the most
// precise description of what the person did wrong — far better than
// restating the operation ("couldn't save") and leaving them to guess.
const BY_CONSTRAINT: Record<string, string> = {
  relationships_parent_unique: "That parent and child are already connected.",
  relationships_symmetric_unique: "Those two are already connected that way.",
  dismissed_suggestions_pkey: "Someone in the family already dismissed that.",
  people_one_claim_per_family:
    "You've already marked someone else in this family as you. Unclaim them first.",
  kind_matches_type: "That kind of relationship doesn't go with that connection type.",
  death_after_birth: "A death date can't come before a birth date.",
  no_self_relationship: "Someone can't be connected to themselves.",
  memberships_family_id_user_id_key: "They're already a member of this family.",
  invites_code_key: "That invite code is already taken. Try again.",
};

/**
 * Database and network errors reach people as toasts, so they have to read as
 * instructions rather than diagnostics. Anything unrecognised is passed
 * through — a raw message beats a vague one when something genuinely
 * unexpected happens.
 */
export function friendlyError(message: string, code?: string): string {
  const lower = message.toLowerCase();

  for (const [constraint, text] of Object.entries(BY_CONSTRAINT)) {
    if (lower.includes(constraint)) return text;
  }

  // The browser's own wording for "no network" is "Failed to fetch".
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (code === "42501" || lower.includes("row-level security")) {
    return "You don't have permission to change that. If you were just removed from this family, reload the page.";
  }
  if (code === "23503") {
    return "That refers to someone who's no longer in the tree. Reload the page and try again.";
  }
  if (code === "23502" || lower.includes("violates not-null")) {
    return "Something required was left blank.";
  }
  if (code === "23505" || lower.includes("duplicate key")) {
    return "That already exists.";
  }
  if (lower.includes("exceeded the maximum allowed size") || lower.includes("payload too large")) {
    return "That file is too large. Photos can be up to 10MB and recordings up to 5MB.";
  }
  if (lower.includes("mime type") || lower.includes("invalid_mime_type")) {
    return "That file type isn't supported.";
  }
  if (lower.includes("jwt") || lower.includes("not authenticated")) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (lower.includes("no family found")) {
    return "No family found for that invite code.";
  }

  // Messages raised deliberately by our own functions are already written for
  // people; they just start lowercase.
  const cleaned = message.replace(/^.*error:\s*/i, "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
