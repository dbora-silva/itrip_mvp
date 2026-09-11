import { getServerSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase/env";

// Never cache: readiness must reflect the current state of the Supabase stack, not a
// snapshot from an earlier request.
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 3000;

type CheckResult = { service: string; ok: boolean; detail: string };

async function checkService(service: string, url: URL, apikey?: string): Promise<CheckResult> {
  try {
    const response = await fetch(url, {
      headers: apikey ? { apikey } : undefined,
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      cache: "no-store",
    });
    return { service, ok: response.ok, detail: `HTTP ${response.status}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return { service, ok: false, detail };
  }
}

/**
 * Readiness: confirms the app can reach the Supabase services it actually depends on —
 * Auth and PostgREST, both through the API gateway — not just that Kong itself answers.
 *
 * Gateway URL resolution uses the same lib/supabase/env.ts helpers as the real
 * server-side Supabase client (lib/supabase/server.ts): SUPABASE_URL (server-only, e.g.
 * http://host.docker.internal:54321 when running inside the app container) falls back
 * to NEXT_PUBLIC_SUPABASE_URL.
 *
 * The public response is intentionally minimal (no URLs, keys, or upstream response
 * bodies) — per-service detail is only written to the server log. Domain tables
 * (profiles/trips/tasks) are not checked here; that belongs to a later phase.
 */
export async function GET() {
  let supabaseUrl: string;
  let anonKey: string;
  try {
    supabaseUrl = getServerSupabaseUrl();
    anonKey = getSupabaseAnonKey();
  } catch {
    console.error("[readiness] supabase_env_not_configured");
    return Response.json({ status: "unavailable" }, { status: 503 });
  }

  const results = await Promise.all([
    checkService("auth", new URL("/auth/v1/health", supabaseUrl), anonKey),
    checkService("rest", new URL("/rest/v1/", supabaseUrl), anonKey),
  ]);

  const failures = results.filter((result) => !result.ok);

  if (failures.length > 0) {
    console.error(
      "[readiness] one or more Supabase services unreachable:",
      failures.map((failure) => `${failure.service}: ${failure.detail}`).join(", "),
    );
    return Response.json({ status: "unavailable" }, { status: 503 });
  }

  return Response.json({ status: "ready" });
}
