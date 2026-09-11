import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, signInAs, tripIdOwnedBy, TEST_USERS } from "./helpers";

describe("trips RLS", () => {
  let asDebora: SupabaseClient;
  let asHugo: SupabaseClient;
  let hugosTripId: string;

  beforeAll(async () => {
    asDebora = await signInAs(TEST_USERS.debora);
    asHugo = await signInAs(TEST_USERS.hugo);
    hugosTripId = await tripIdOwnedBy(TEST_USERS.hugo, "Feira de tecnologia");
  });

  afterAll(async () => {
    await asDebora.auth.signOut();
    await asHugo.auth.signOut();
  });

  it("lets a user see exactly their own trips (seed dataset: 4 each)", async () => {
    const { data, error } = await asDebora.from("trips").select("id, name");
    expect(error).toBeNull();
    expect(data).toHaveLength(4);

    const { data: hugoData } = await asHugo.from("trips").select("id, name");
    expect(hugoData).toHaveLength(4);
  });

  it("hides another user's trip entirely from select (no row, not an error)", async () => {
    const { data, error } = await asDebora.from("trips").select("id").eq("id", hugosTripId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("does not modify another user's trip on update, and leaves it unchanged", async () => {
    const { data: before } = await asHugo
      .from("trips")
      .select("name, updated_at")
      .eq("id", hugosTripId)
      .single();

    const { data: updateResult, error } = await asDebora
      .from("trips")
      .update({ name: "hijacked" })
      .eq("id", hugosTripId)
      .select();

    // RLS makes the row invisible to the update's WHERE clause, so this is not an error —
    // it is a successful update of zero rows. Absence of an error is not enough evidence
    // on its own: assert zero rows returned AND that the original data is byte-for-byte
    // unchanged when read back by its actual owner.
    expect(error).toBeNull();
    expect(updateResult).toHaveLength(0);

    const { data: after } = await asHugo
      .from("trips")
      .select("name, updated_at")
      .eq("id", hugosTripId)
      .single();
    expect(after).toEqual(before);
  });

  it("does not delete another user's trip", async () => {
    const { data: deleteResult, error } = await asDebora
      .from("trips")
      .delete()
      .eq("id", hugosTripId)
      .select();
    expect(error).toBeNull();
    expect(deleteResult).toHaveLength(0);

    const { data: stillThere, error: readError } = await asHugo
      .from("trips")
      .select("id")
      .eq("id", hugosTripId)
      .single();
    expect(readError).toBeNull();
    expect(stillThere?.id).toBe(hugosTripId);
  });

  it("blocks an anonymous client from reading any trip", async () => {
    // anon has no GRANT at all on public.trips (revoked explicitly in the migration), which
    // is stricter than RLS alone: this is a table-level "permission denied" (42501), not a
    // silently-empty, RLS-filtered result.
    const anon = anonClient();
    const { data, error } = await anon.from("trips").select("id");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("blocks an anonymous client from inserting a trip", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("trips")
      .insert({
        owner_id: "00000000-0000-0000-0000-000000000000",
        name: "Should not exist",
        destination: "Nowhere",
        start_date: "2026-01-01",
        end_date: "2026-01-02",
      })
      .select();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("exposes trips_with_status under the same RLS as trips itself", async () => {
    const { data, error } = await asDebora.from("trips_with_status").select("id, status");
    expect(error).toBeNull();
    expect(data).toHaveLength(4);
    for (const row of data ?? []) {
      expect(["planning", "upcoming", "ongoing", "completed"]).toContain(row.status);
    }

    const { data: anonView, error: anonError } = await anonClient()
      .from("trips_with_status")
      .select("id");
    expect(anonView).toBeNull();
    expect(anonError).not.toBeNull();
  });

  it("updates updated_at on a real change made by the owner", async () => {
    const { data: original } = await asDebora
      .from("trips")
      .select("id, updated_at")
      .eq("name", "Trilha na Patagônia")
      .single();
    expect(original).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 10));

    const { data: updated, error } = await asDebora
      .from("trips")
      .update({ description: "atualizado pelo teste" })
      .eq("id", original!.id)
      .select("updated_at")
      .single();

    expect(error).toBeNull();
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
      new Date(original!.updated_at).getTime(),
    );
  });
});
