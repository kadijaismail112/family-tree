import { describe, expect, it } from "vitest";
import { asOtpType, readAuthLink, reasonFor } from "./authLink";

const q = (search: string) => new URLSearchParams(search);

describe("what kind of link came back", () => {
  it("reads a PKCE code", () => {
    const shape = readAuthLink(q("code=abc123"));
    expect(shape.kind).toBe("code");
    expect(shape.code).toBe("abc123");
  });

  it("reads a hashed token and its type", () => {
    const shape = readAuthLink(q("token_hash=xyz&type=signup"));
    expect(shape.kind).toBe("token_hash");
    expect(shape.tokenHash).toBe("xyz");
    expect(shape.type).toBe("signup");
  });

  it("ignores a token whose type it does not recognise", () => {
    expect(readAuthLink(q("token_hash=xyz&type=nonsense")).kind).toBe("none");
  });

  it("reports nothing usable when the query string is empty", () => {
    expect(readAuthLink(q("")).kind).toBe("none");
  });

  it("treats Supabase's own error as an error, not as a missing code", () => {
    // the old code saw no `code` here and blamed the mail client for
    // truncating the link, which sent people looking for the wrong problem
    const shape = readAuthLink(
      q("error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")
    );
    expect(shape.kind).toBe("error");
    expect(shape.reason).toBe("expired");
  });

  it("prefers the error over a code when both somehow appear", () => {
    expect(readAuthLink(q("error=access_denied&code=abc")).kind).toBe("error");
  });
});

describe("turning Supabase's reason into advice", () => {
  it("calls a spent or expired token expired", () => {
    expect(reasonFor("otp_expired", null)).toBe("expired");
    expect(reasonFor(null, "access_denied")).toBe("expired");
  });

  it("falls back to a general failure for anything else", () => {
    expect(reasonFor("server_error", null)).toBe("failed");
    expect(reasonFor(null, null)).toBe("failed");
  });

  it("is not upset by odd casing", () => {
    expect(reasonFor("OTP_EXPIRED", null)).toBe("expired");
  });
});

describe("the confirmation kinds we accept", () => {
  it("accepts the ones Supabase actually sends", () => {
    for (const t of ["signup", "invite", "magiclink", "recovery", "email_change", "email"]) {
      expect(asOtpType(t)).toBe(t);
    }
  });

  it("refuses anything else, including nothing at all", () => {
    expect(asOtpType("phone_change")).toBeNull();
    expect(asOtpType("")).toBeNull();
    expect(asOtpType(null)).toBeNull();
  });
});
