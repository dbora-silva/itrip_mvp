import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold text-foreground">Entrar</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-foreground underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </main>
  );
}
