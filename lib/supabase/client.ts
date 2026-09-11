import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseCookieOptions, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Browser-only client. Cookie *access* is not configured explicitly — @supabase/ssr
 * falls back to reading/writing `document.cookie` automatically, which is what lets it
 * share the same session cookies the server client and proxy read. `cookieOptions` is
 * still set explicitly (see getSupabaseCookieOptions) since the library's own defaults
 * never mark the cookie `secure`.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: getSupabaseCookieOptions(),
  });
}
