import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Local convenience: sign in as a throwaway account without going through
 * email confirmation.
 *
 * The password used to be a constant in this file. That was fine while the
 * repository was private and stopped being fine the moment it wasn't: the
 * route is gated to development, but *logging in is not*, so anyone reading
 * the source knew a working credential for the live site. The account it had
 * already created in the production project outlived the convenience.
 *
 * So there is no password here any more, and no default. Set DEV_LOGIN_PASSWORD
 * in .env.local to something only you know. Without it this route reports
 * nothing and does nothing — the same answer it gives in production, so its
 * existence isn't something you can probe for either.
 */

const DEV_EMAIL = "dev@example.com";
const DEV_NAME = "Developer";

export async function POST() {
  const password = process.env.DEV_LOGIN_PASSWORD;

  // Not development, or no password configured: identical answer in both
  // cases, so the response never confirms the route is here.
  if (process.env.NODE_ENV !== "development" || !password) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (password.length < 12) {
    return NextResponse.json(
      { error: "DEV_LOGIN_PASSWORD must be at least 12 characters." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: DEV_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { display_name: DEV_NAME },
    });

    if (error) {
      const duplicate =
        error.message.toLowerCase().includes("already") ||
        error.message.toLowerCase().includes("registered") ||
        error.status === 422;
      if (!duplicate) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
      const existing = list.users.find(
        (u) => u.email?.toLowerCase() === DEV_EMAIL
      );
      if (!existing) {
        return NextResponse.json(
          { error: "Dev user exists but could not be found." },
          { status: 500 }
        );
      }
      const { error: updateError } = await admin.auth.admin.updateUserById(
        existing.id,
        { password, email_confirm: true }
      );
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else if (data.user && !data.user.user_metadata?.display_name) {
      await admin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { display_name: DEV_NAME },
      });
    }

    return NextResponse.json({ email: DEV_EMAIL, password });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dev login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
