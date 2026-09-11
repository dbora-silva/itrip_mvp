/**
 * Validates and resolves the `next` redirect target used after login/signup.
 *
 * Allowlist-based, not blocklist-based: nothing except "/dashboard" itself or a path
 * segment directly under it is ever accepted. This intentionally also rejects "/login"
 * and "/cadastro" (they simply do not match the allowlist), which is what keeps the
 * login <-> dashboard redirect from ever looping — see lib/auth/proxy-decision.ts.
 */

const TRUSTED_ORIGIN = "https://itrip.local";
const DEFAULT_REDIRECT = "/dashboard";

// Exactly "/dashboard", or "/dashboard/segment/segment..." with plain segments only.
// No dots, no encoded characters, no empty segments — deliberately conservative since
// no subroute exists yet in this phase.
const SAFE_DASHBOARD_PATH = /^\/dashboard(\/[a-zA-Z0-9_-]+)*$/;

// Control characters (0x00-0x1f, 0x7f) or a literal backslash. Deliberately matched
// before any URL parsing — see the comment below on why backslash is dangerous.
const UNSAFE_CHARACTERS = /[\x00-\x1f\x7f\\]/;

/**
 * @param candidate Untrusted value from a `next` query parameter (or null/absent).
 * @returns A same-origin pathname safe to pass to `redirect()`, defaulting to
 *          "/dashboard" for anything that isn't unambiguously an internal dashboard path.
 */
export function resolvePostLoginRedirect(candidate: string | null | undefined): string {
  if (!candidate) return DEFAULT_REDIRECT;

  // Backslash is treated as a path/authority separator by the WHATWG URL parser for
  // special schemes (http/https), which could otherwise smuggle a different host through
  // (e.g. "/\\evil.com"). Control characters are rejected outright rather than relying on
  // the parser to strip them.
  if (UNSAFE_CHARACTERS.test(candidate)) return DEFAULT_REDIRECT;

  let url: URL;
  try {
    // Resolving against a fixed trusted origin is what turns "is this the same origin?"
    // into a simple equality check below — it also rejects absolute URLs and
    // protocol-relative ("//host/...") values, since those resolve to a *different*
    // origin than TRUSTED_ORIGIN.
    url = new URL(candidate, TRUSTED_ORIGIN);
  } catch {
    return DEFAULT_REDIRECT;
  }

  if (url.origin !== TRUSTED_ORIGIN) return DEFAULT_REDIRECT;

  let decodedPathname: string;
  try {
    // Reject on the *decoded* path, not the raw one: percent-encoded traversal segments
    // (e.g. "%2e%2e") are not resolved by the URL parser's dot-segment normalization, so
    // checking the raw pathname alone could accept something that decodes to a path
    // outside the allowlist.
    decodedPathname = decodeURIComponent(url.pathname);
  } catch {
    return DEFAULT_REDIRECT;
  }

  if (!SAFE_DASHBOARD_PATH.test(decodedPathname)) return DEFAULT_REDIRECT;

  return decodedPathname;
}

/**
 * Builds "/login?next=<path>" using URLSearchParams (never manual string
 * concatenation), so the encoding of `path` is always correct regardless of its content.
 */
export function buildLoginRedirectUrl(path: string): string {
  const params = new URLSearchParams({ next: path });
  return `/login?${params.toString()}`;
}
