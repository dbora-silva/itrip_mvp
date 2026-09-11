import Link from "next/link";
import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold text-foreground">Criar conta</h1>
      <SignupForm />
      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </main>
  );
}
