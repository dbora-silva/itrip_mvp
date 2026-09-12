"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/features/auth/schemas";
import { signUp } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    // A successful signup ends in redirect() on the server and never returns here —
    // reaching this line at all means it failed.
    const result = await signUp(values);
    if (result.status === "error") {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          setError(field as keyof SignupInput, { message: messages[0] });
        }
      }
      if (result.formError) {
        setFormError(result.formError);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-name">Nome</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "signup-name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="signup-name-error" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-email">E-mail</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="signup-email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-password">Senha</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "signup-password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="signup-password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-confirm-password">Confirmar senha</Label>
        <Input
          id="signup-confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? "signup-confirm-password-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="signup-confirm-password-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
