import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { TripForm } from "@/features/trips/components/trip-form";

export default function NewTripPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Minhas viagens
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nova viagem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados para adicionar um novo destino.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <TripForm mode="create" />
      </div>
    </div>
  );
}
