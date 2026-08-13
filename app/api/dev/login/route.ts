import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "rootline-dev-bypass";
const DEV_NAME = "Developer";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
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
        { password: DEV_PASSWORD, email_confirm: true }
      );
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else if (data.user && !data.user.user_metadata?.display_name) {
      await admin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { display_name: DEV_NAME },
      });
    }

    return NextResponse.json({ email: DEV_EMAIL, password: DEV_PASSWORD });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dev login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
