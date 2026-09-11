import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLoginRedirectUrl } from "@/lib/auth/redirect";

/**
 * Second layer of protection for the private area, independent of proxy.ts. Next.js
 * itself warns that Server Functions are not separately gated by the proxy's matcher,
 * so anything actually private must re-check here (or in the Server Action it calls)
 * rather than assume the proxy already handled it.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(buildLoginRedirectUrl("/dashboard"));
  }

  return children;
}
