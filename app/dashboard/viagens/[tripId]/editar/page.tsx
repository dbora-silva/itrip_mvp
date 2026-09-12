import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTripById } from "@/features/trips/queries";
import { TripForm } from "@/features/trips/components/trip-form";

interface EditTripPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function EditTripPage({ params }: EditTripPageProps) {
  const { tripId } = await params;
  const trip = await getTripById(tripId, `/dashboard/viagens/${tripId}/editar`);
  if (!trip) notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link
        href={`/dashboard/viagens/${trip.id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {trip.name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editar viagem</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atualize os dados desta viagem.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <TripForm
          mode="edit"
          tripId={trip.id}
          defaultValues={{
            name: trip.name,
            destination: trip.destination,
            description: trip.description ?? "",
            itinerary: trip.itinerary ?? "",
            start_date: trip.startDate,
            end_date: trip.endDate,
          }}
        />
      </div>
    </div>
  );
}
