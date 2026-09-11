"use server";

import { redirect } from "next/navigation";
import {
  loginSchema,
  signupSchema,
  type LoginInput,
  type SignupInput,
} from "@/features/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePostLoginRedirect } from "@/lib/auth/redirect";
import { logAuthError } from "@/lib/auth/log";
import { interpretSignUpResult } from "@/features/auth/signup-outcome";
import type { AuthActionState } from "@/features/auth/action-state";

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const GENERIC_SIGNUP_ERROR =
  "Não foi possível concluir o cadastro. Verifique os dados e tente novamente.";

export async function signIn(values: LoginInput, next: string | null): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let signInFailed = true;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    signInFailed = Boolean(error);
    if (error) logAuthError("sign_in", error);
  } catch (unexpected) {
    logAuthError("sign_in", unexpected);
  }

  if (signInFailed) {
    return { status: "error", formError: GENERIC_LOGIN_ERROR };
  }

  // Deliberately outside the try/catch above: redirect() throws an internal
  // NEXT_REDIRECT signal that Next.js must see propagate — catching it here (even by
  // accident, via a broad catch) would turn a successful sign-in into a reported error.
  // Nothing between the try/catch ending and this call can fail, so there is nothing
  // left that legitimately needs to be wrapped.
  redirect(resolvePostLoginRedirect(next));
}

export async function signUp(values: SignupInput): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let signUpFailed = true;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { name: parsed.data.name } },
    });

    const outcome = interpretSignUpResult(data, error);
    signUpFailed = outcome.kind !== "success";
    if (signUpFailed) {
      // error is null for "no_session" (an unexpected shape, not a Supabase error) —
      // logAuthError's category falls back to the outcome kind in that case so the log
      // still distinguishes it from a real Supabase error.
      logAuthError("sign_up", error ?? { code: outcome.kind });
    }
  } catch (unexpected) {
    logAuthError("sign_up", unexpected);
  }

  if (signUpFailed) {
    // Same generic message regardless of *why* — duplicate email, an unexpected
    // "no session" response, or any other failure all look identical to the caller.
    // This is what prevents account enumeration through the signup form.
    return { status: "error", formError: GENERIC_SIGNUP_ERROR };
  }

  redirect(resolvePostLoginRedirect(null));
}

export async function signOut(): Promise<never> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error: claimsError } = await supabase.auth.getClaims();

    if (!claimsError && data?.claims) {
      const { error } = await supabase.auth.signOut();
      if (error) logAuthError("sign_out", error);
    }
    // No valid session: nothing to sign out of — not an error, same outcome either way
    // (redirect to /login below), so a signed-out visitor calling this cannot tell the
    // difference from someone who really had a session.
  } catch (unexpected) {
    logAuthError("sign_out", unexpected);
  }

  redirect("/login");
}
