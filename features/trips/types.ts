export type TripStatus = "planning" | "upcoming" | "ongoing" | "completed";

/** App-facing shape (camelCase), decoupled from the DB's snake_case row shape. */
export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string | null;
  itinerary: string | null;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TripFilters {
  q?: string;
  status?: TripStatus;
}

export type TripActionState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors?: Record<string, string[]>;
      formError?: string;
    };

export const IDLE_TRIP_ACTION_STATE: TripActionState = { status: "idle" };
