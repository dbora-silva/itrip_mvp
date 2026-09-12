import Link from "next/link";

interface TripItineraryProps {
  tripId: string;
  itinerary: string | null;
}

/**
 * Renders `itinerary` as plain text only — it is interpolated as ordinary JSX text
 * content, never passed to `dangerouslySetInnerHTML`, so React escapes it the same way
 * it escapes any other text: HTML-looking input (`<script>...`) or Markdown-looking
 * input is displayed exactly as typed, never parsed or executed. `whitespace-pre-wrap`
 * preserves the line breaks the user typed without needing any markup to do so.
 */
export function TripItinerary({ tripId, itinerary }: TripItineraryProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">Roteiro da viagem</h2>
      {itinerary ? (
        <p className="mt-3 whitespace-pre-wrap text-foreground">{itinerary}</p>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">Nenhum roteiro adicionado ainda.</p>
          <Link
            href={`/dashboard/viagens/${tripId}/editar`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Adicionar roteiro
          </Link>
        </div>
      )}
    </section>
  );
}
