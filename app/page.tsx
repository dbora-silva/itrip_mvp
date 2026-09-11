import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">iTrip</h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Organize suas viagens em um só lugar. A aplicação está em construção.
      </p>
      <Button disabled>Em breve</Button>
    </main>
  );
}
