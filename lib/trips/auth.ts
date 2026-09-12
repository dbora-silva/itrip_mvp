import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLoginRedirectUrl } from "@/lib/auth/redirect";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * For Server Components that read trip data. Independent of proxy.ts and
 * app/dashboard/layout.tsx — those already gate every /dashboard/** request, but each
 * query still re-checks so it never depends on either layer having run (see
 * docs/security.md, Phase 6, on why this is a third, independent check rather than
 * decoration).
 *
 * A missing/invalid session here is a navigation, not an error to report inline: the
 * two earlier layers would already have redirected in the normal case, so reaching this
 * point without a session only happens on a race (cookie expired mid-render) — the
 * correct outcome is still just "go to login", identical to what those layers do.
 *
 * Returns the Supabase client so the caller's actual data query reuses the same
 * getClaims() round-trip instead of paying for a second one.
 */
export async function requireSupabaseForRead(pathname: string): Promise<SupabaseServerClient> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect(buildLoginRedirectUrl(pathname));
  }
  return supabase;
}

/**
 * For Server Actions (mutations). A missing/expired session is reported back to the
 * caller like any other actionable outcome — never a hard redirect mid-submission, and
 * never folded into the generic "operation failed" message either: SESSION_EXPIRED_ERROR
 * below exists specifically so a routine session expiry doesn't read like a database
 * problem in the log or to the user. The caller decides what to render.
 */
export async function getSupabaseForMutation(): Promise<
  { ok: true; supabase: SupabaseServerClient } | { ok: false }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return { ok: false };
  }
  return { ok: true, supabase };
}

export const SESSION_EXPIRED_ERROR = "Sua sessão expirou. Atualize a página e entre novamente.";
