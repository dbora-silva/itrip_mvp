import { Suspense } from "react";
import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, MapPinIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTripById } from "@/features/trips/queries";
import { StatusBadge } from "@/features/trips/components/status-badge";
import { DeleteTripDialog } from "@/features/trips/components/delete-trip-dialog";
import { TripItinerary } from "@/features/trips/components/trip-itinerary";
import { TripSuccessMessage } from "@/features/trips/components/trip-success-message";
import { buttonVariants } from "@/components/ui/button";
import { formatCivilDateBR } from "@/lib/dates/civil-date";

interface TripDetailPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { tripId } = await params;
  const trip = await getTripById(tripId, `/dashboard/viagens/${tripId}`);
  if (!trip) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Minhas viagens
      </Link>

      <Suspense fallback={null}>
        <TripSuccessMessage />
      </Suspense>

      <article className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{trip.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
              {trip.destination}
            </p>
          </div>
          <StatusBadge status={trip.status} />
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
          {formatCivilDateBR(trip.startDate)} – {formatCivilDateBR(trip.endDate)}
        </p>

        {trip.description && (
          <p className="border-t border-border pt-4 whitespace-pre-wrap text-foreground">
            {trip.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Link
            href={`/dashboard/viagens/${trip.id}/editar`}
            className={buttonVariants({ variant: "outline" })}
          >
            Editar viagem
          </Link>
          <DeleteTripDialog tripId={trip.id} tripName={trip.name} size="default" />
        </div>
      </article>

      <TripItinerary tripId={trip.id} itinerary={trip.itinerary} />
    </div>
  );
}
