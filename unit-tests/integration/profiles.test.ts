import { describe, expect, it } from "vitest";
import { adminClient, anonClient, TEST_PASSWORD } from "./helpers";

function uniqueTestEmail(): string {
  return `signup-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

describe("signup -> profile creation", () => {
  it("creates a profile automatically when signup includes a valid name", async () => {
    const email = uniqueTestEmail();
    const client = anonClient();

    const { data, error } = await client.auth.signUp({
      email,
      password: TEST_PASSWORD,
      options: { data: { name: "Teste Integração" } },
    });
    expect(error).toBeNull();
    expect(data.user).not.toBeNull();

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("name")
      .eq("id", data.user!.id)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.name).toBe("Teste Integração");

    await admin.auth.admin.deleteUser(data.user!.id);
  });

  it("rejects signup without a name and leaves no orphaned auth user behind", async () => {
    const email = uniqueTestEmail();
    const client = anonClient();

    const { data, error } = await client.auth.signUp({
      email,
      password: TEST_PASSWORD,
      options: { data: {} },
    });

    // The handle_new_user() trigger raises inside the same transaction as the
    // auth.users insert, so signUp itself must fail — there is nothing to clean up if
    // this assertion holds.
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();

    const admin = adminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const orphan = usersPage.users.find((user) => user.email === email);
    expect(orphan).toBeUndefined();
  });

  it("rejects signup with a whitespace-only name, leaving no orphaned auth user", async () => {
    const email = uniqueTestEmail();
    const client = anonClient();

    const { data, error } = await client.auth.signUp({
      email,
      password: TEST_PASSWORD,
      options: { data: { name: "   " } },
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();

    const admin = adminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    expect(usersPage.users.find((user) => user.email === email)).toBeUndefined();
  });
});
