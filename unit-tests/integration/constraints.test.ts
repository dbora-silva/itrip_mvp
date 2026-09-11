import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, signInAs, TEST_USERS } from "./helpers";

describe("constraints and normalization", () => {
  let asDebora: SupabaseClient;
  // This file is the only place, besides the fixed seed dataset, that creates real trips
  // for the seed users — track and delete everything it creates so other integration
  // test files (e.g. rls-trips.test.ts, which asserts an exact trip count for Debora)
  // are not affected by leftovers, regardless of test file run order.
  const createdTripIds: string[] = [];

  beforeAll(async () => {
    asDebora = await signInAs(TEST_USERS.debora);
  });

  afterAll(async () => {
    if (createdTripIds.length > 0) {
      await asDebora.from("trips").delete().in("id", createdTripIds);
    }
  });

  it("rejects a trip whose end_date is before start_date", async () => {
    const { data, error } = await asDebora
      .from("trips")
      .insert({
        name: "Datas invertidas",
        destination: "Teste",
        start_date: "2026-05-10",
        end_date: "2026-05-01",
      })
      .select();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("rejects a trip name that is only whitespace", async () => {
    const { data, error } = await asDebora
      .from("trips")
      .insert({
        name: "   ",
        destination: "Teste",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      })
      .select();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("rejects a task title that is empty", async () => {
    const { data: trip } = await asDebora
      .from("trips")
      .insert({
        name: "Viagem para teste de constraint",
        destination: "Teste",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      })
      .select("id")
      .single();
    createdTripIds.push(trip!.id);

    const { data, error } = await asDebora
      .from("tasks")
      .insert({ trip_id: trip!.id, title: "" })
      .select();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("stores name/destination/title already trimmed", async () => {
    const { data: trip, error } = await asDebora
      .from("trips")
      .insert({
        name: "  Nome com espaços  ",
        destination: "  Destino com espaços  ",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      })
      .select("id, name, destination")
      .single();

    expect(error).toBeNull();
    expect(trip?.name).toBe("Nome com espaços");
    expect(trip?.destination).toBe("Destino com espaços");
    createdTripIds.push(trip!.id);
  });

  describe("compute_trip_status boundaries (via RPC)", () => {
    it.each([
      [-5, -1, "completed"],
      [0, 0, "ongoing"],
      [-3, 0, "ongoing"],
      [30, 35, "upcoming"],
      [31, 35, "planning"],
    ] as const)("start %i / end %i -> %s", async (startOffset, endOffset, expected) => {
      const start = offsetDate(startOffset);
      const end = offsetDate(endOffset);
      const { data, error } = await anonClient().rpc("compute_trip_status", {
        p_start_date: start,
        p_end_date: end,
      });
      expect(error).toBeNull();
      expect(data).toBe(expected);
    });

    it("returns null when either date is null", async () => {
      const { data, error } = await anonClient().rpc("compute_trip_status", {
        p_start_date: null,
        p_end_date: "2026-01-01",
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });
});

function offsetDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
