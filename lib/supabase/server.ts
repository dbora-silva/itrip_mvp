import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getServerSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
} from "@/lib/supabase/env";

/**
 * Creates a fresh Supabase client for the current request. Must be called anew for
 * every Server Component render / Server Action / Route Handler — never cached or
 * reused across requests or stored at module scope (this is @supabase/ssr's own
 * documented requirement).
 *
 * Cookie writes only take effect when called from a Server Action or Route Handler.
 * Server Components cannot set cookies at all — Next.js throws if you try — so the
 * `catch` below silently no-ops in that case. When that happens, the session is kept
 * fresh by proxy.ts instead, which runs before the Server Component and can write
 * cookies on the response.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getServerSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render — expected, see doc comment above.
        }
      },
    },
  });
}
