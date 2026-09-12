import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface TripsEmptyStateProps {
  variant: "no-trips" | "no-results";
}

export function TripsEmptyState({ variant }: TripsEmptyStateProps) {
  if (variant === "no-trips") {
    return (
      <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <CompassIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground">Nenhuma viagem cadastrada ainda.</p>
        <Link href="/dashboard/viagens/nova" className={buttonVariants()}>
          Criar viagem
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <CompassIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-muted-foreground">Nenhuma viagem encontrada para estes filtros.</p>
      <Link href="/dashboard" className="text-sm font-medium underline underline-offset-4">
        Limpar filtros
      </Link>
    </section>
  );
}
