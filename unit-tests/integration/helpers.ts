// Shared setup for integration tests: discovers the local Supabase instance the same
// safe way supabase/seed-users.mjs does (never from process.env / .env.local), so these
// tests can never accidentally run against a hosted project.
import { spawnSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function getLocalSupabaseStatus() {
  const result = spawnSync("npx supabase status -o json", { encoding: "utf8", shell: true });

  if (result.error || result.status !== 0) {
    throw new Error(
      "Could not read `supabase status`. Is the local stack running? (`npm run supabase:start`)",
    );
  }

  const jsonStart = result.stdout.indexOf("{");
  if (jsonStart === -1) {
    throw new Error("`supabase status -o json` did not return a JSON object.");
  }

  const parsed = JSON.parse(result.stdout.slice(jsonStart)) as Record<string, string>;
  const url = new URL(parsed.API_URL);

  if (url.protocol !== "http:" || !ALLOWED_HOSTNAMES.has(url.hostname) || url.port === "") {
    throw new Error(`Refusing to run integration tests against non-local URL: ${parsed.API_URL}`);
  }

  return { url: url.toString(), anonKey: parsed.ANON_KEY, serviceRoleKey: parsed.SERVICE_ROLE_KEY };
}

export const LOCAL_SUPABASE = getLocalSupabaseStatus();
export const TEST_PASSWORD = "ItripLocal123!";

export const TEST_USERS = {
  debora: "debora@example.test",
  hugo: "hugo@example.test",
} as const;

export function anonClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.anonKey);
}

/** Setup/inspection only — bypasses RLS. Never used to make the assertions themselves. */
export function adminClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function signInAs(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

export async function tripIdOwnedBy(email: string, name: string): Promise<string> {
  const admin = adminClient();
  const { data: user } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const owner = user.users.find((u) => u.email === email);
  if (!owner) throw new Error(`seed user not found: ${email}`);

  const { data, error } = await admin
    .from("trips")
    .select("id")
    .eq("owner_id", owner.id)
    .eq("name", name)
    .single();
  if (error || !data) throw new Error(`seed trip not found: ${email} / "${name}"`);
  return data.id as string;
}
