import { CalendarDaysIcon, MapPinIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ITINERARY_STOPS = ["Florença", "San Gimignano", "Siena"];
const COMPLETED_TASKS = 6;
const TOTAL_TASKS = 8;

/**
 * Static, illustrative-only preview of what a trip looks like inside iTrip — no
 * database, auth, or real trip data involved. Grouped under one accessible name so
 * assistive tech announces it as a single example rather than unrelated fragments.
 */
export function TripPreviewCard() {
  return (
    <div
      role="group"
      aria-label="Exemplo de card de viagem no iTrip"
      className="w-full rounded-2xl border border-border bg-card p-5 shadow-md sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Destino</p>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-foreground">
            <MapPinIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Toscana, Itália
          </p>
        </div>
        <Badge className="bg-orange-100 text-orange-700">Próxima viagem</Badge>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
        4–10 de julho
      </p>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground">Roteiro</p>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
          {ITINERARY_STOPS.map((stop) => (
            <li key={stop} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              {stop}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Tarefas</span>
          <span>
            {COMPLETED_TASKS} de {TOTAL_TASKS} concluídas
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={COMPLETED_TASKS}
          aria-valuemin={0}
          aria-valuemax={TOTAL_TASKS}
          aria-label={`Tarefas concluídas: ${COMPLETED_TASKS} de ${TOTAL_TASKS}`}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/15"
        >
          <div className="h-full w-3/4 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
