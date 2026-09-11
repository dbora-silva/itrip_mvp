/**
 * Serializable result returned by every auth Server Action. Never carries a password,
 * a Supabase error object, or any other Supabase response — only what the UI needs to
 * render. A successful login/signup does not produce a value here at all: it ends in
 * `redirect()` instead (see features/auth/actions.ts on why that must stay outside any
 * try/catch that handles the Supabase call's own errors).
 */
export type AuthActionState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors?: Record<string, string[]>;
      formError?: string;
    };

export const IDLE_ACTION_STATE: AuthActionState = { status: "idle" };
