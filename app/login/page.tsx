import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Link
        href="/"
        className="flex items-center gap-2 self-center text-lg font-semibold tracking-tight text-foreground"
      >
        <Logo />
        iTrip
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Entrar</h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Acesse sua conta para organizar suas viagens.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-foreground underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </main>
  );
}
