import { Suspense } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { listTrips } from "@/features/trips/queries";
import { TripList } from "@/features/trips/components/trip-list";
import { TripFilters } from "@/features/trips/components/trip-filters";
import { TripSuccessMessage } from "@/features/trips/components/trip-success-message";
import { buttonVariants } from "@/components/ui/button";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const rawFilters = await searchParams;
  const { trips, filters } = await listTrips(rawFilters, "/dashboard");

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Minhas viagens</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organize seus próximos destinos.</p>
        </div>
        <Link href="/dashboard/viagens/nova" className={buttonVariants({ className: "shrink-0" })}>
          <PlusIcon data-icon="inline-start" />
          Nova viagem
        </Link>
      </div>

      <Suspense fallback={null}>
        <TripSuccessMessage />
      </Suspense>

      <TripFilters filters={filters} />

      <TripList trips={trips} filters={filters} />
    </>
  );
}
