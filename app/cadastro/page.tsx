import Link from "next/link";
import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Link href="/" className="text-center text-lg font-semibold tracking-tight text-foreground">
        iTrip
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Criar conta</h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Comece a organizar suas próximas viagens.
        </p>
        <SignupForm />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </main>
  );
}
