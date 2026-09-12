import Link from "next/link";

/**
 * Rendered inside app/dashboard/layout.tsx's shell (nav + <main> already provided there)
 * for any not-found trigger under /dashboard/** — in practice, getTripById() returning
 * null for a malformed UUID, a nonexistent trip, or a trip owned by someone else. All
 * three reach this exact same page; the requested id is never included in the message.
 */
export default function DashboardNotFound() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">Viagem não encontrada</h1>
      <p className="text-muted-foreground">
        Esta viagem não existe ou não está disponível para sua conta.
      </p>
      <Link href="/dashboard" className="text-sm font-medium underline underline-offset-4">
        Voltar para Minhas viagens
      </Link>
    </section>
  );
}
