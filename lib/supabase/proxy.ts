import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getServerSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
} from "@/lib/supabase/env";
import { decideProxyAction } from "@/lib/auth/proxy-decision";

/**
 * Refreshes the Supabase session for the incoming request and applies
 * lib/auth/proxy-decision.ts's routing decision.
 *
 * Session validity is checked with `getClaims()`, per Supabase's current guidance —
 * NOT `getSession()`, which only reads whatever is in the cookie without verifying it
 * is still valid. Whether `getClaims()` verifies the JWT locally or calls the Auth
 * server depends on how the project's JWTs are signed (see docs/security.md); either
 * way, it is the correct call here.
 *
 * The routing decision is made *after* the session check, so any refreshed cookies
 * (collected via `setAll` below) are applied to whichever response is ultimately
 * returned — including a redirect response, which a more naive implementation could
 * accidentally drop.
 */
export async function updateSession(request: NextRequest) {
  const cookiesToSet: { name: string; value: string; options?: CookieOptions }[] = [];
  let responseHeaders: Record<string, string> = {};

  const supabase = createServerClient(getServerSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies, headers) {
        cookiesToSet.push(...newCookies);
        responseHeaders = headers;
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims);

  const decision = decideProxyAction(request.nextUrl.pathname, isAuthenticated);

  let response: NextResponse;
  if (decision.action === "redirect") {
    response = NextResponse.redirect(new URL(decision.to, request.url));
  } else {
    // Mutating request.cookies before constructing NextResponse.next({ request }) makes
    // the refreshed session visible to Server Components rendered later in this same
    // request, not just to the next request the browser makes.
    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
    response = NextResponse.next({ request });
  }

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options ?? {});
  });
  Object.entries(responseHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
