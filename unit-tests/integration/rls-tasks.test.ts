import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, signInAs, tripIdOwnedBy, TEST_USERS } from "./helpers";

describe("tasks RLS", () => {
  let asDebora: SupabaseClient;
  let asHugo: SupabaseClient;
  let hugosTripId: string;
  let deborasTripId: string;
  let hugosTaskId: string;
  let deborasTaskId: string;

  beforeAll(async () => {
    asDebora = await signInAs(TEST_USERS.debora);
    asHugo = await signInAs(TEST_USERS.hugo);
    hugosTripId = await tripIdOwnedBy(TEST_USERS.hugo, "Feira de tecnologia");
    deborasTripId = await tripIdOwnedBy(TEST_USERS.debora, "Réveillon em Buenos Aires");

    const admin = adminClient();
    const { data: hugoTask } = await admin
      .from("tasks")
      .select("id")
      .eq("trip_id", hugosTripId)
      .limit(1)
      .single();
    hugosTaskId = hugoTask!.id;

    const { data: deboraTask } = await admin
      .from("tasks")
      .select("id")
      .eq("trip_id", deborasTripId)
      .limit(1)
      .single();
    deborasTaskId = deboraTask!.id;
  });

  afterAll(async () => {
    await asDebora.auth.signOut();
    await asHugo.auth.signOut();
  });

  it("lets a user see tasks belonging to their own trips only", async () => {
    const { data, error } = await asDebora.from("tasks").select("id").eq("trip_id", hugosTripId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("does not let a user create a task on another user's trip", async () => {
    // INSERT with a trip_id that fails WITH CHECK raises an error (unlike SELECT/DELETE,
    // which just filter rows silently via USING) — data is null, not an empty array.
    const { data, error } = await asDebora
      .from("tasks")
      .insert({ trip_id: hugosTripId, title: "intrusive task" })
      .select();
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    const { count } = await adminClient()
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", hugosTripId)
      .eq("title", "intrusive task");
    expect(count).toBe(0);
  });

  it("does not let a user move their own task onto another user's trip", async () => {
    const { data: before } = await adminClient()
      .from("tasks")
      .select("trip_id")
      .eq("id", deborasTaskId)
      .single();

    // This task's *current* trip_id is Debora's own trip, so USING lets the row match —
    // it's the *new* trip_id (Hugo's trip) that WITH CHECK rejects, so this is an error,
    // not a silently-filtered zero-row update.
    const { data: updateResult, error } = await asDebora
      .from("tasks")
      .update({ trip_id: hugosTripId })
      .eq("id", deborasTaskId)
      .select();

    expect(updateResult).toBeNull();
    expect(error).not.toBeNull();

    const { data: after } = await adminClient()
      .from("tasks")
      .select("trip_id")
      .eq("id", deborasTaskId)
      .single();
    expect(after?.trip_id).toBe(before?.trip_id);
  });

  it("does not let a user update or delete another user's task", async () => {
    const { data: before } = await adminClient()
      .from("tasks")
      .select("title, status")
      .eq("id", hugosTaskId)
      .single();

    const { data: updateResult } = await asDebora
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", hugosTaskId)
      .select();
    expect(updateResult).toHaveLength(0);

    const { data: deleteResult } = await asDebora
      .from("tasks")
      .delete()
      .eq("id", hugosTaskId)
      .select();
    expect(deleteResult).toHaveLength(0);

    const { data: after } = await adminClient()
      .from("tasks")
      .select("title, status")
      .eq("id", hugosTaskId)
      .single();
    expect(after).toEqual(before);
  });

  it("blocks an anonymous client from reading or writing tasks", async () => {
    // Same reasoning as the trips test: anon has no GRANT at all on public.tasks, so this
    // is a table-level permission error, not an RLS-filtered empty result.
    const anon = anonClient();
    const { data: readData, error: readError } = await anon.from("tasks").select("id");
    expect(readData).toBeNull();
    expect(readError).not.toBeNull();

    const { data: writeData, error: writeError } = await anon
      .from("tasks")
      .insert({ trip_id: hugosTripId, title: "anon task" })
      .select();
    expect(writeData).toBeNull();
    expect(writeError).not.toBeNull();
  });

  it("cascades: deleting a trip removes its tasks", async () => {
    const { data: trip } = await asDebora
      .from("trips")
      .insert({
        name: "Viagem temporária para teste de cascade",
        destination: "Teste",
        start_date: "2026-01-01",
        end_date: "2026-01-02",
      })
      .select("id")
      .single();
    const tripId = trip!.id;

    const { data: task } = await asDebora
      .from("tasks")
      .insert({ trip_id: tripId, title: "tarefa temporária" })
      .select("id")
      .single();
    const taskId = task!.id;

    await asDebora.from("trips").delete().eq("id", tripId);

    const { data: remainingTask } = await adminClient().from("tasks").select("id").eq("id", taskId);
    expect(remainingTask).toHaveLength(0);
  });
});
