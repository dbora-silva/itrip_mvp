import { describe, expect, it } from "vitest";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { interpretSignUpResult } from "@/features/auth/signup-outcome";

const fakeUser = { id: "00000000-0000-0000-0000-000000000000" } as User;
const fakeSession = { access_token: "x" } as Session;

function fakeAuthError(code: string): AuthError {
  return { name: "AuthApiError", message: "irrelevant", status: 422, code } as AuthError;
}

describe("interpretSignUpResult", () => {
  it("is success when there is no error and a session was returned", () => {
    const outcome = interpretSignUpResult({ user: fakeUser, session: fakeSession }, null);
    expect(outcome).toEqual({ kind: "success" });
  });

  it("is duplicate_email for the user_already_exists error code", () => {
    const outcome = interpretSignUpResult(null, fakeAuthError("user_already_exists"));
    expect(outcome).toEqual({ kind: "duplicate_email" });
  });

  it("is duplicate_email for the email_exists error code", () => {
    const outcome = interpretSignUpResult(null, fakeAuthError("email_exists"));
    expect(outcome).toEqual({ kind: "duplicate_email" });
  });

  it("is error for any other error code", () => {
    const outcome = interpretSignUpResult(null, fakeAuthError("weak_password"));
    expect(outcome).toEqual({ kind: "error" });
  });

  it(
    "is no_session when signUp() returns no error but also no session " +
      "(defensive — not reproduced by this project's local config, see doc comment)",
    () => {
      const outcome = interpretSignUpResult({ user: fakeUser, session: null }, null);
      expect(outcome).toEqual({ kind: "no_session" });
    },
  );

  it("is no_session when data itself is null and there is no error", () => {
    const outcome = interpretSignUpResult(null, null);
    expect(outcome).toEqual({ kind: "no_session" });
  });
});
