import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Reading an emailed auth link.
 *
 * Supabase sends people back from a confirmation email in more than one
 * shape, and the difference decides both what we do and what we tell them.
 * Kept apart from the route so the decisions can be tested without a browser
 * or a server — this is the code path every new member arrives through, and a
 * wrong answer here strands them.
 */

const OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/** the confirmation kinds we accept from a link, ignoring anything else */
export function asOtpType(raw: string | null | undefined): EmailOtpType | null {
  return raw && OTP_TYPES.has(raw) ? (raw as EmailOtpType) : null;
}

export type LinkFailure = "expired" | "failed" | "link";

/**
 * Supabase's own reason for refusing, turned into the advice that fixes it.
 *
 * `otp_expired` is the one that matters in practice, and it rarely means what
 * it says: mail scanners follow links in incoming mail to check them, and
 * following a one-time link spends it, so the token is often already used by
 * the time the person taps it.
 */
export function reasonFor(
  errorCode: string | null | undefined,
  error: string | null | undefined
): LinkFailure {
  const code = `${errorCode ?? ""} ${error ?? ""}`.toLowerCase();
  if (code.includes("expired") || code.includes("access_denied")) return "expired";
  return "failed";
}

export interface LinkShape {
  kind: "code" | "token_hash" | "error" | "none";
  code?: string;
  tokenHash?: string;
  type?: EmailOtpType;
  reason?: LinkFailure;
}

/** What kind of link this is, decided in one place rather than three. */
export function readAuthLink(params: URLSearchParams): LinkShape {
  const error = params.get("error");
  const errorCode = params.get("error_code");
  if (error || errorCode) {
    return { kind: "error", reason: reasonFor(errorCode, error) };
  }

  const code = params.get("code");
  if (code) return { kind: "code", code };

  const tokenHash = params.get("token_hash");
  const type = asOtpType(params.get("type"));
  if (tokenHash && type) return { kind: "token_hash", tokenHash, type };

  // Nothing usable in the query string. It may still be an implicit-flow link
  // carrying its tokens in the fragment, which never reaches a server.
  return { kind: "none" };
}
