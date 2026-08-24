import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextUrl } from "@/lib/safeNext";
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
    path.startsWith("/settings") ||
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
      // A signed-in relative who opens login?next=/invite/… used to be dumped
      // on the dashboard and lose the invitation. Honour a safe next, and
      // never bounce them back onto another auth page.
      const { pathname, search } = safeNextUrl(
        request.nextUrl.searchParams.get("next")
      );
      const dest = request.nextUrl.clone();
      if (AUTH_PAGES.has(pathname)) {
        dest.pathname = "/dashboard";
        dest.search = "";
      } else {
        dest.pathname = pathname;
        dest.search = search;
      }
      return NextResponse.redirect(dest);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next({ request });
  }
}
