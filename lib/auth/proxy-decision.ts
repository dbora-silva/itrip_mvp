import { buildLoginRedirectUrl } from "@/lib/auth/redirect";

export type ProxyDecision = { action: "next" } | { action: "redirect"; to: string };

const PRIVATE_PREFIX = "/dashboard";
const AUTH_PATHS = new Set(["/login", "/cadastro"]);

/**
 * Pure routing decision, deliberately separated from proxy.ts so it can be unit tested
 * without a real NextRequest/NextResponse. Structurally loop-free: the private-area
 * branch and the auth-pages branch are mutually exclusive (a pathname cannot be both
 * "/dashboard..." and "/login"/"/cadastro"), and each branch's redirect target lands in
 * the *other* branch's "do nothing" case, never back into a branch that redirects again.
 */
export function decideProxyAction(pathname: string, isAuthenticated: boolean): ProxyDecision {
  const isPrivatePath = pathname === PRIVATE_PREFIX || pathname.startsWith(`${PRIVATE_PREFIX}/`);
  const isAuthPagePath = AUTH_PATHS.has(pathname);

  if (isPrivatePath && !isAuthenticated) {
    return { action: "redirect", to: buildLoginRedirectUrl(pathname) };
  }

  if (isAuthPagePath && isAuthenticated) {
    return { action: "redirect", to: "/dashboard" };
  }

  return { action: "next" };
}
