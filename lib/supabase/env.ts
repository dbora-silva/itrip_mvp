export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.");
  return key;
}

/**
 * Server-only override for environments where the public URL (what the browser
 * resolves) differs from what the server process itself can reach — e.g. the app
 * running inside the Docker container against a local Supabase stack, where
 * `host.docker.internal` resolves but `localhost` would point at the container itself.
 * See docs/local-environment.md. Falls back to the public URL, which is correct for
 * `npm run dev` on the host and for a hosted Supabase project either way.
 */
export function getServerSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? getSupabaseUrl();
}

/**
 * @supabase/ssr's own DEFAULT_COOKIE_OPTIONS (verified in its installed source,
 * node_modules/@supabase/ssr/dist/module/utils/constants.js) never sets `secure` —
 * there is no automatic HTTPS detection anywhere in the package. Without this, the
 * session cookie would be sendable over plain HTTP even in production. `NODE_ENV` is
 * "production" for `next build`/`next start` (including the Docker image) and
 * "development" for `next dev`, so this only requires HTTPS once the app is actually
 * deployed that way, never blocking local development over plain HTTP.
 */
export function getSupabaseCookieOptions() {
  return { secure: process.env.NODE_ENV === "production" };
}
