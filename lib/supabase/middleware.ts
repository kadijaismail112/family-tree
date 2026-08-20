import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

const AUTH_PAGES = new Set(["/login", "/signup", "/forgot-password"]);

// `/invite/<token>` is deliberately absent: an invited relative has no account
// yet, and bouncing them to a sign-in screen before they can see who invited
// them or to what is how an invitation gets ignored. The page shows the
// invitation, then sends them to sign up carrying the token.
function isProtected(path: string) {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/family") ||
    path.startsWith("/auth/update-password")
  );
}

export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({ request });

    const { url, key } = supabaseEnv();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([header, value]) =>
            supabaseResponse.headers.set(header, value)
          );
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const path = request.nextUrl.pathname;

    if (!user && isProtected(path)) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      login.searchParams.set("next", path + request.nextUrl.search);
      return NextResponse.redirect(login);
    }

    if (user && AUTH_PAGES.has(path)) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/dashboard";
      dest.search = "";
      return NextResponse.redirect(dest);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next({ request });
  }
}
