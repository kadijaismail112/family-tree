import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";
import { readAuthLink } from "@/lib/authLink";

/**
 * Where every emailed link lands: confirming an account, resetting a
 * password, coming back to an invitation.
 *
 * This used to understand exactly one shape of link and blame the mail client
 * for everything else — "the link was missing its sign-in code, some mail apps
 * cut long links short". That was a guess, and usually the wrong one. Supabase
 * says why it refused, in the query string, and we were discarding it.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));

  // Carry the destination through every failure. Dropping it meant an invited
  // relative whose link failed was sent to a sign-in page that had forgotten
  // the invitation, and landed on an empty dashboard afterwards wondering
  // where it had gone.
  const backToLogin = (reason: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${reason}&next=${encodeURIComponent(next)}`
    );

  const link = readAuthLink(searchParams);

  if (link.kind === "error") return backToLogin(link.reason ?? "failed");

  const supabase = createClient();

  if (link.kind === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code!);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return backToLogin("expired");
  }

  if (link.kind === "token_hash") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: link.tokenHash!,
      type: link.type!,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return backToLogin("expired");
  }

  // Nothing usable in the query string. It may still be an implicit-flow link,
  // whose tokens ride in the URL fragment and never reach a server at all.
  // Browsers keep the fragment across this redirect, so the sign-in page picks
  // it up from there; if there is genuinely nothing, "the link was cut short"
  // is by then the likely answer.
  return backToLogin("link");
}
