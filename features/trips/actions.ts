"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { tripFormSchema, uuidSchema, type TripFormInput } from "@/features/trips/schemas";
import { getSupabaseForMutation, SESSION_EXPIRED_ERROR } from "@/lib/trips/auth";
import { logTripsError } from "@/lib/trips/log";
import type { TripActionState } from "@/features/trips/types";

const GENERIC_TRIP_ERROR = "Não foi possível salvar as alterações. Tente novamente.";
const GENERIC_DELETE_ERROR = "Não foi possível excluir a viagem. Tente novamente.";

export async function createTrip(values: TripFormInput): Promise<TripActionState> {
  const parsed = tripFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const session = await getSupabaseForMutation();
  if (!session.ok) {
    return { status: "error", formError: SESSION_EXPIRED_ERROR };
  }

  let newTripId: string | null = null;
  try {
    // Explicit allowlist, never `...parsed.data`: this is the only place the insert
    // payload is built, so a field the schema didn't intend to allow through (status,
    // owner_id, id, ...) can never reach the database even if the schema changes later.
    // owner_id is not listed here at all — the column's `default auth.uid()` (see
    // supabase/migrations/20260911191157_create_trips.sql) is what sets it.
    const { data, error } = await session.supabase
      .from("trips")
      .insert({
        name: parsed.data.name,
        destination: parsed.data.destination,
        description: parsed.data.description,
        itinerary: parsed.data.itinerary,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
      })
      .select("id")
      .single();

    if (error || !data) {
      logTripsError("create_trip", error ?? { code: "no_row_returned" });
    } else {
      newTripId = data.id as string;
    }
  } catch (unexpected) {
    logTripsError("create_trip", unexpected);
  }

  if (!newTripId) {
    return { status: "error", formError: GENERIC_TRIP_ERROR };
  }

  // Outside the try/catch: redirect()'s internal NEXT_REDIRECT throw must never be
  // caught by the block above (see features/auth/actions.ts for the same discipline).
  revalidatePath("/dashboard");
  redirect(`/dashboard/viagens/${newTripId}?criado=1`);
}

export async function updateTrip(
  rawTripId: string,
  values: TripFormInput,
): Promise<TripActionState> {
  const parsedId = uuidSchema.safeParse(rawTripId);
  if (!parsedId.success) {
    return { status: "error", formError: GENERIC_TRIP_ERROR };
  }

  const parsed = tripFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const session = await getSupabaseForMutation();
  if (!session.ok) {
    return { status: "error", formError: SESSION_EXPIRED_ERROR };
  }

  let updated = false;
  try {
    const { data, error } = await session.supabase
      .from("trips")
      .update({
        name: parsed.data.name,
        destination: parsed.data.destination,
        description: parsed.data.description,
        itinerary: parsed.data.itinerary,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
      })
      .eq("id", parsedId.data)
      .select("id");

    // A real Supabase error and "0 rows matched" (wrong id, or someone else's trip — RLS's
    // USING clause filters it out silently, no error) are deliberately treated identically:
    // both end in the exact same generic failure, so neither the message nor the log lets
    // a caller distinguish "doesn't exist" from "not yours".
    if (error || !data || data.length === 0) {
      logTripsError("update_trip", error ?? { code: "no_rows_affected" });
    } else {
      updated = true;
    }
  } catch (unexpected) {
    logTripsError("update_trip", unexpected);
  }

  if (!updated) {
    return { status: "error", formError: GENERIC_TRIP_ERROR };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/viagens/${parsedId.data}`);
  redirect(`/dashboard/viagens/${parsedId.data}?editado=1`);
}

export async function deleteTrip(rawTripId: string): Promise<TripActionState> {
  const parsedId = uuidSchema.safeParse(rawTripId);
  if (!parsedId.success) {
    return { status: "error", formError: GENERIC_DELETE_ERROR };
  }

  const session = await getSupabaseForMutation();
  if (!session.ok) {
    return { status: "error", formError: SESSION_EXPIRED_ERROR };
  }

  let deleted = false;
  try {
    // Cascades to that trip's tasks automatically (tasks.trip_id references trips(id) on
    // delete cascade — supabase/migrations/20260911191257_create_tasks.sql); nothing to
    // do here for that.
    const { data, error } = await session.supabase
      .from("trips")
      .delete()
      .eq("id", parsedId.data)
      .select("id");

    if (error || !data || data.length === 0) {
      logTripsError("delete_trip", error ?? { code: "no_rows_affected" });
    } else {
      deleted = true;
    }
  } catch (unexpected) {
    logTripsError("delete_trip", unexpected);
  }

  if (!deleted) {
    return { status: "error", formError: GENERIC_DELETE_ERROR };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?excluido=1");
}
