import type { AuthError, Session, User } from "@supabase/supabase-js";

export type SignUpOutcome =
  { kind: "success" } | { kind: "duplicate_email" } | { kind: "no_session" } | { kind: "error" };

const DUPLICATE_EMAIL_CODES = new Set(["user_already_exists", "email_exists"]);

/**
 * Pure interpretation of a `supabase.auth.signUp()` result — deliberately separated
 * from the Server Action itself so every branch can be unit tested with hand-built
 * fixtures, including "no_session", which this project's local Supabase configuration
 * (email confirmations disabled) does not currently produce for a real duplicate-email
 * attempt (that case returns a `user_already_exists` error instead — verified against
 * the local instance). Coding for "no_session" anyway is what makes the signup action
 * correct if that assumption ever stops holding — e.g. a hosted project configured
 * differently.
 *
 * `duplicate_email` and `no_session` and `error` are intentionally NOT distinguished by
 * the caller when building the user-facing message — collapsing them into the same
 * generic text is what prevents account enumeration through signup.
 */
export function interpretSignUpResult(
  data: { user: User | null; session: Session | null } | null,
  error: AuthError | null,
): SignUpOutcome {
  if (error) {
    if (error.code && DUPLICATE_EMAIL_CODES.has(error.code)) {
      return { kind: "duplicate_email" };
    }
    return { kind: "error" };
  }

  if (!data?.session) {
    return { kind: "no_session" };
  }

  return { kind: "success" };
}
