import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <CompassIcon className="size-7" aria-hidden="true" />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">iTrip</h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Organize suas viagens em um só lugar.
      </p>
      <div className="flex gap-3">
        <Link href="/cadastro" className={buttonVariants({ size: "lg" })}>
          Criar conta
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Entrar
        </Link>
      </div>
    </main>
  );
}
