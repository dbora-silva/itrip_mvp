import type { TripStatus } from "@/features/trips/types";

interface StatusPresentation {
  label: string;
  variant: "default" | "secondary" | "outline" | "ghost";
}

/**
 * Pure label/style lookup — status itself always comes from compute_trip_status() via
 * trips_with_status / search_trips (see supabase/migrations). This function never
 * inspects a date; the `never` in the default branch below makes an unhandled
 * TripStatus a compile-time error rather than something a runtime test would need to
 * catch.
 */
export function getStatusPresentation(status: TripStatus): StatusPresentation {
  switch (status) {
    case "ongoing":
      return { label: "Em andamento", variant: "default" };
    case "upcoming":
      return { label: "Em breve", variant: "secondary" };
    case "planning":
      return { label: "Planejamento", variant: "outline" };
    case "completed":
      return { label: "Concluída", variant: "ghost" };
    default: {
      const exhaustiveCheck: never = status;
      throw new Error(`Unhandled trip status: ${String(exhaustiveCheck)}`);
    }
  }
}
