import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  civilDateOffsetFromTodayUTC,
  signInAs,
  TEST_USERS,
  tripIdOwnedBy,
} from "./helpers";

/**
 * Tests the application-layer contract that features/trips/{queries,actions}.ts rely on:
 * the search_trips RPC, and the trips / trips_with_status writes and reads it wraps.
 * Like unit-tests/integration/auth.test.ts (Phase 5), this calls the real Supabase client
 * directly rather than the Next.js Server Actions/Server Components themselves — those
 * depend on next/headers' cookies(), which only exists inside an actual Next.js request,
 * not in a plain Vitest process. rls-trips.test.ts (Phase 4) already proves the RLS
 * policies in isolation; this file proves what Phase 6's code is actually built on top of
 * them: search_trips's escaping/ordering, and the exact write-rejection behavior actions.ts
 * depends on to keep `status`/`owner_id` out of client control.
 */
describe("trips application layer", () => {
  let asDebora: SupabaseClient;
  let asHugo: SupabaseClient;
  const createdTripIds: string[] = [];

  beforeAll(async () => {
    asDebora = await signInAs(TEST_USERS.debora);
    asHugo = await signInAs(TEST_USERS.hugo);
  });

  afterAll(async () => {
    if (createdTripIds.length > 0) {
      await asDebora.from("trips").delete().in("id", createdTripIds);
    }
    await asDebora.auth.signOut();
    await asHugo.auth.signOut();
  });

  async function insertTrip(
    client: SupabaseClient,
    overrides: Partial<{
      name: string;
      destination: string;
      description: string | null;
      itinerary: string | null;
      start_date: string;
      end_date: string;
    }>,
  ) {
    const { data, error } = await client
      .from("trips")
      .insert({
        name: "Viagem de teste",
        destination: "Destino de teste",
        start_date: civilDateOffsetFromTodayUTC(1),
        end_date: civilDateOffsetFromTodayUTC(2),
        ...overrides,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`failed to seed test trip: ${error?.message}`);
    createdTripIds.push(data.id as string);
    return data as { id: string; [key: string]: unknown };
  }

  describe("create / edit / delete", () => {
    it("creates a trip for the authenticated user", async () => {
      const trip = await insertTrip(asDebora, { name: "IT6 Criar" });
      expect(trip.name).toBe("IT6 Criar");
      expect(trip.owner_id).toBeDefined();
    });

    it("edits the caller's own trip", async () => {
      const trip = await insertTrip(asDebora, { name: "IT6 Editar Original" });
      const { data, error } = await asDebora
        .from("trips")
        .update({ name: "IT6 Editar Novo" })
        .eq("id", trip.id)
        .select();
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].name).toBe("IT6 Editar Novo");
    });

    it("deletes the caller's own trip", async () => {
      const trip = await insertTrip(asDebora, { name: "IT6 Excluir" });
      const { data, error } = await asDebora.from("trips").delete().eq("id", trip.id).select();
      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      const { data: stillThere } = await asDebora
        .from("trips")
        .select("id")
        .eq("id", trip.id)
        .maybeSingle();
      expect(stillThere).toBeNull();
    });

    it("rejects editing another user's trip, leaving it unchanged (0 rows affected)", async () => {
      const hugosTripId = await tripIdOwnedBy(TEST_USERS.hugo, "Feira de tecnologia");
      const { data: before } = await asHugo
        .from("trips")
        .select("name")
        .eq("id", hugosTripId)
        .single();

      const { data, error } = await asDebora
        .from("trips")
        .update({ name: "sequestrada" })
        .eq("id", hugosTripId)
        .select();
      expect(error).toBeNull();
      expect(data).toHaveLength(0);

      const { data: after } = await asHugo
        .from("trips")
        .select("name")
        .eq("id", hugosTripId)
        .single();
      expect(after?.name).toBe(before?.name);
    });

    it("rejects deleting another user's trip (0 rows affected, still there)", async () => {
      const hugosTripId = await tripIdOwnedBy(TEST_USERS.hugo, "Feira de tecnologia");
      const { data, error } = await asDebora.from("trips").delete().eq("id", hugosTripId).select();
      expect(error).toBeNull();
      expect(data).toHaveLength(0);

      const { data: stillThere, error: readError } = await asHugo
        .from("trips")
        .select("id")
        .eq("id", hugosTripId)
        .single();
      expect(readError).toBeNull();
      expect(stillThere?.id).toBe(hugosTripId);
    });
  });

  describe("status and owner_id cannot be written", () => {
    it("rejects an insert carrying a status field (PGRST204, no row created)", async () => {
      const { data, error } = await asDebora
        .from("trips")
        .insert({
          name: "IT6 Status Injetado",
          destination: "X",
          start_date: civilDateOffsetFromTodayUTC(1),
          end_date: civilDateOffsetFromTodayUTC(2),
          status: "completed",
        })
        .select();
      expect(data).toBeNull();
      expect(error?.code).toBe("PGRST204");

      const { data: found } = await asDebora
        .from("trips")
        .select("id")
        .eq("name", "IT6 Status Injetado");
      expect(found).toHaveLength(0);
    });

    it("rejects an update carrying a status field (PGRST204, row unchanged)", async () => {
      const trip = await insertTrip(asDebora, { name: "IT6 Status Update" });
      const { data, error } = await asDebora
        .from("trips")
        .update({ status: "completed" })
        .eq("id", trip.id)
        .select();
      expect(data).toBeNull();
      expect(error?.code).toBe("PGRST204");
    });

    it("rejects an insert carrying a foreign owner_id (RLS 42501, no row created)", async () => {
      const { data, error } = await asDebora
        .from("trips")
        .insert({
          name: "IT6 Owner Injetado",
          destination: "X",
          start_date: civilDateOffsetFromTodayUTC(1),
          end_date: civilDateOffsetFromTodayUTC(2),
          owner_id: "00000000-0000-0000-0000-000000000001",
        })
        .select();
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("defaults owner_id to the caller via auth.uid() when omitted", async () => {
      const trip = await insertTrip(asDebora, { name: "IT6 Owner Default" });
      const { data: userData } = await asDebora.auth.getUser();
      expect(trip.owner_id).toBe(userData.user?.id);
    });
  });

  describe("id lookups", () => {
    it("returns no row (not an error) for a well-formed but nonexistent id", async () => {
      const { data, error } = await asDebora
        .from("trips_with_status")
        .select("id")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("returns an error (not silently empty) for a malformed uuid at the DB layer", async () => {
      // This is exactly why features/trips/queries.ts validates with uuidSchema *before*
      // ever querying: a malformed id reaching PostgREST directly is a 400, not a clean
      // "not found" — the app converts both into the same notFound() outcome upstream of
      // this boundary, not at it.
      const { data, error } = await asDebora
        .from("trips_with_status")
        .select("id")
        .eq("id", "not-a-uuid")
        .maybeSingle();
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });
  });

  describe("civil dates round-trip without timezone shift", () => {
    it("returns the exact start_date/end_date strings that were written", async () => {
      const trip = await insertTrip(asDebora, {
        name: "IT6 Data Civil",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
      });
      const { data, error } = await asDebora
        .from("trips_with_status")
        .select("start_date, end_date")
        .eq("id", trip.id)
        .single();
      expect(error).toBeNull();
      expect(data?.start_date).toBe("2026-01-01");
      expect(data?.end_date).toBe("2026-12-31");
    });
  });

  describe("itinerary", () => {
    it("persists the itinerary on create", async () => {
      const trip = await insertTrip(asDebora, {
        name: "IT6 Itinerary Criar",
        itinerary: "Dia 1: chegada\nDia 2: passeio",
      });
      expect(trip.itinerary).toBe("Dia 1: chegada\nDia 2: passeio");
    });

    it("persists a null itinerary when omitted", async () => {
      const trip = await insertTrip(asDebora, { name: "IT6 Itinerary Ausente" });
      expect(trip.itinerary).toBeNull();
    });

    it("updates the itinerary on edit", async () => {
      const trip = await insertTrip(asDebora, {
        name: "IT6 Itinerary Editar",
        itinerary: "Roteiro original",
      });
      const { data, error } = await asDebora
        .from("trips")
        .update({ itinerary: "Roteiro atualizado" })
        .eq("id", trip.id)
        .select("itinerary");
      expect(error).toBeNull();
      expect(data?.[0].itinerary).toBe("Roteiro atualizado");
    });

    it("persists null after clearing a previously set itinerary", async () => {
      const trip = await insertTrip(asDebora, {
        name: "IT6 Itinerary Remover",
        itinerary: "Roteiro a ser removido",
      });
      const { data, error } = await asDebora
        .from("trips")
        .update({ itinerary: null })
        .eq("id", trip.id)
        .select("itinerary");
      expect(error).toBeNull();
      expect(data?.[0].itinerary).toBeNull();
    });

    it("RLS hides another user's itinerary the same way it hides everything else", async () => {
      const hugosTripId = await tripIdOwnedBy(TEST_USERS.hugo, "Feira de tecnologia");
      const { data, error } = await asDebora
        .from("trips_with_status")
        .select("id, itinerary")
        .eq("id", hugosTripId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("search_trips returns itinerary only for the caller's own visible trips", async () => {
      await insertTrip(asDebora, {
        name: "IT6 Itinerary RPC",
        itinerary: "Roteiro exclusivo da Debora",
      });

      const { data, error } = await asDebora.rpc("search_trips", {
        p_search: "IT6 Itinerary RPC",
        p_status: null,
      });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].itinerary).toBe("Roteiro exclusivo da Debora");

      const { data: hugoData, error: hugoError } = await asHugo.rpc("search_trips", {
        p_search: "IT6 Itinerary RPC",
        p_status: null,
      });
      expect(hugoError).toBeNull();
      expect(hugoData).toHaveLength(0);
    });
  });

  describe("search_trips RPC", () => {
    const PREFIX = "IT6SEARCH";

    beforeAll(async () => {
      await insertTrip(asDebora, {
        name: `${PREFIX} Ongoing Um`,
        destination: "Roma",
        start_date: civilDateOffsetFromTodayUTC(-1),
        end_date: civilDateOffsetFromTodayUTC(1),
      });
      await insertTrip(asDebora, {
        name: `${PREFIX} Upcoming Um`,
        destination: "Paris",
        start_date: civilDateOffsetFromTodayUTC(5),
        end_date: civilDateOffsetFromTodayUTC(6),
      });
      await insertTrip(asDebora, {
        name: `${PREFIX} Upcoming Dois`,
        destination: "Lisboa",
        start_date: civilDateOffsetFromTodayUTC(10),
        end_date: civilDateOffsetFromTodayUTC(12),
      });
      await insertTrip(asDebora, {
        name: `${PREFIX} Planning Um`,
        destination: "Tóquio",
        start_date: civilDateOffsetFromTodayUTC(60),
        end_date: civilDateOffsetFromTodayUTC(65),
      });
      await insertTrip(asDebora, {
        name: `${PREFIX} Completed Recente`,
        destination: "Berlim",
        start_date: civilDateOffsetFromTodayUTC(-10),
        end_date: civilDateOffsetFromTodayUTC(-5),
      });
      await insertTrip(asDebora, {
        name: `${PREFIX} Completed Antiga`,
        destination: "Cairo",
        start_date: civilDateOffsetFromTodayUTC(-30),
        end_date: civilDateOffsetFromTodayUTC(-25),
      });
    });

    async function search(p_search: string | null, p_status: string | null = null) {
      const { data, error } = await asDebora.rpc("search_trips", { p_search, p_status });
      expect(error).toBeNull();
      return (data ?? []) as { name: string; status: string }[];
    }

    it("orders results ongoing, upcoming, planning, completed as groups", async () => {
      const results = await search(PREFIX);
      const statusSequence = results.map((r) => r.status);
      expect(statusSequence).toEqual([
        "ongoing",
        "upcoming",
        "upcoming",
        "planning",
        "completed",
        "completed",
      ]);
    });

    it("orders non-completed groups by start_date ascending", async () => {
      const results = await search(PREFIX);
      const upcomingNames = results.filter((r) => r.status === "upcoming").map((r) => r.name);
      expect(upcomingNames).toEqual([`${PREFIX} Upcoming Um`, `${PREFIX} Upcoming Dois`]);
    });

    it("orders the completed group by start_date descending (most recent finish first)", async () => {
      const results = await search(PREFIX);
      const completedNames = results.filter((r) => r.status === "completed").map((r) => r.name);
      expect(completedNames).toEqual([`${PREFIX} Completed Recente`, `${PREFIX} Completed Antiga`]);
    });

    it("searches by name", async () => {
      const results = await search(`${PREFIX} Ongoing`);
      expect(results.map((r) => r.name)).toEqual([`${PREFIX} Ongoing Um`]);
    });

    it("searches by destination", async () => {
      const results = await search("Tóquio");
      expect(results.some((r) => r.name === `${PREFIX} Planning Um`)).toBe(true);
    });

    it("is case-insensitive", async () => {
      const results = await search(`${PREFIX.toLowerCase()} ongoing`);
      expect(results.map((r) => r.name)).toEqual([`${PREFIX} Ongoing Um`]);
    });

    it("combines search and status", async () => {
      const results = await search(PREFIX, "completed");
      expect(results.map((r) => r.name)).toEqual([
        `${PREFIX} Completed Recente`,
        `${PREFIX} Completed Antiga`,
      ]);
    });

    it("filters by status alone", async () => {
      const results = await search(PREFIX, "planning");
      expect(results.map((r) => r.name)).toEqual([`${PREFIX} Planning Um`]);
    });

    it("returns everything when the search term is empty", async () => {
      const results = await search("", null);
      expect(results.length).toBeGreaterThanOrEqual(6);
    });

    it("returns only the caller's own trips, never another user's", async () => {
      const asHugoResults = await (async () => {
        const { data, error } = await asHugo.rpc("search_trips", {
          p_search: PREFIX,
          p_status: null,
        });
        expect(error).toBeNull();
        return data ?? [];
      })();
      expect(asHugoResults).toHaveLength(0);
    });

    it.each([
      ["comma", `${PREFIX},x)y(z`],
      ["parentheses", `(${PREFIX})`],
      ["double quote", `"${PREFIX}"`],
      ["single quote", `${PREFIX}'s`],
      ["backslash", `${PREFIX}\\x`],
      ["accented text", "Tóquio"],
      ["text with spaces", `${PREFIX} Ongoing Um`],
    ])("does not error on a search term containing a %s", async (_label, term) => {
      const { error } = await asDebora.rpc("search_trips", { p_search: term, p_status: null });
      expect(error).toBeNull();
    });

    it("treats % as a literal character, not a wildcard", async () => {
      const results = await search("%");
      expect(results).toHaveLength(0);
    });

    it("treats _ as a literal character, not a single-character wildcard", async () => {
      // "Rom_" would match "Roma" if `_` were a real SQL wildcard; it must not.
      const results = await search("Rom_");
      expect(results).toHaveLength(0);
    });

    it("rejects an invalid status value at the database layer (defense in depth)", async () => {
      const { data, error } = await asDebora.rpc("search_trips", {
        p_search: null,
        p_status: "nao_existe",
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe("22P02");
    });

    it("is not executable by an anonymous client", async () => {
      const { data, error } = await anonClient().rpc("search_trips", {
        p_search: null,
        p_status: null,
      });
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });
  });
});
