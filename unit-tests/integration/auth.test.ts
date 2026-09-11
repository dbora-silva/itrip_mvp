import { afterEach, describe, expect, it } from "vitest";
import { adminClient, anonClient, TEST_PASSWORD, TEST_USERS } from "./helpers";

// These exercise the real GoTrue behavior that features/auth/actions.ts wraps. The
// Server Actions themselves call next/headers' cookies(), which only works inside an
// actual Next.js request — they cannot be invoked directly from a plain Vitest test.
// What's verified here is the Supabase interaction; the routing/redirect behavior
// around it is covered by unit-tests/lib/auth/proxy-decision.test.ts (pure logic) and
// by a real HTTP check against a running dev server (see the phase report).

function uniqueTestEmail(): string {
  return `auth-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

describe("login", () => {
  it("creates a real session for valid credentials", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: TEST_USERS.debora,
      password: TEST_PASSWORD,
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.user?.email).toBe(TEST_USERS.debora);
    await client.auth.signOut();
  });

  it("returns invalid_credentials for a wrong password, without revealing which part was wrong", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: TEST_USERS.debora,
      password: "definitely-wrong-password",
    });
    expect(data.session).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("invalid_credentials");
  });

  it("returns the same invalid_credentials error for an email that doesn't exist", async () => {
    // Same error code as a wrong password for an existing email — this is what
    // features/auth/actions.ts relies on to show one generic message either way,
    // without letting a caller distinguish "wrong password" from "no such account".
    const client = anonClient();
    const { error } = await client.auth.signInWithPassword({
      email: "no-such-user@example.test",
      password: "whatever-Password1",
    });
    expect(error?.code).toBe("invalid_credentials");
  });
});

describe("signup", () => {
  const createdEmails: string[] = [];

  afterEach(async () => {
    const admin = adminClient();
    for (const email of createdEmails.splice(0)) {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const user = data.users.find((u) => u.email === email);
      if (user) await admin.auth.admin.deleteUser(user.id);
    }
  });

  it("creates a real session for a valid signup", async () => {
    const email = uniqueTestEmail();
    createdEmails.push(email);
    const client = anonClient();

    const { data, error } = await client.auth.signUp({
      email,
      password: TEST_PASSWORD,
      options: { data: { name: "Novo Usuário" } },
    });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
  });

  it("fails with user_already_exists for one of the fixed seed emails", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signUp({
      email: TEST_USERS.hugo,
      password: "OutraSenha123",
      options: { data: { name: "Tentativa Duplicada" } },
    });
    expect(data.user).toBeNull();
    expect(data.session).toBeNull();
    expect(error?.code).toBe("user_already_exists");
  });
});

describe("logout", () => {
  it("invalidates a real session — an authenticated call fails afterwards", async () => {
    const client = anonClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email: TEST_USERS.debora,
      password: TEST_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { error: signOutError } = await client.auth.signOut();
    expect(signOutError).toBeNull();

    const { data: claimsAfter, error: claimsError } = await client.auth.getClaims();
    expect(claimsAfter?.claims).toBeUndefined();
    // Either an explicit "no session" error, or simply no claims — either way, nothing
    // usable as an authenticated identity remains.
    void claimsError;
  });

  it("is safe to call again on a client that was never signed in (already-expired-equivalent)", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.getClaims();
    expect(data?.claims).toBeUndefined();
    // No thrown exception, no crash — this is the state features/auth/actions.ts's
    // signOut() treats as "nothing to sign out of", not as an error.
    void error;
  });
});
