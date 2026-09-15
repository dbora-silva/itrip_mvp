import Link from "next/link";
import { ListChecksIcon, MapIcon, RouteIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/home/site-header";
import { TripPreviewCard } from "@/components/home/trip-preview-card";

const BENEFITS = [
  {
    icon: MapIcon,
    title: "Organize suas viagens",
    description: "Mantenha destinos, períodos e informações importantes reunidos.",
  },
  {
    icon: RouteIcon,
    title: "Monte seu roteiro",
    description: "Planeje atividades e lugares para cada etapa da viagem.",
  },
  {
    icon: ListChecksIcon,
    title: "Acompanhe suas tarefas",
    description: "Controle reservas, documentos e outros preparativos.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
          <div className="flex flex-col items-start gap-6">
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Planeje hoje. Viaje melhor.
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Organize destinos, datas, tarefas e roteiros em um só lugar.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/cadastro" className={buttonVariants({ size: "lg" })}>
                Planejar minha viagem
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-primary/30 text-primary hover:bg-primary/5",
                )}
              >
                Já tenho uma conta
              </Link>
            </div>
          </div>

          <div className="w-full max-w-sm justify-self-center lg:justify-self-end">
            <TripPreviewCard />
          </div>
        </section>

        <section
          aria-label="Benefícios do iTrip"
          className="flex flex-1 flex-col justify-center border-t border-border"
        >
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
            {BENEFITS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <p className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          <span className="font-medium text-foreground">iTrip</span> · Organize suas viagens em um
          só lugar.
        </p>
      </footer>
    </>
  );
}
