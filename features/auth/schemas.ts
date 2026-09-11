import { z } from "zod";

// Mirrors profiles.name's DB constraint (1-120 chars after trim) — see
// supabase/migrations/20260911191057_create_profiles.sql.
const nameSchema = z
  .string()
  .trim()
  .min(1, "Informe seu nome.")
  .max(120, "O nome pode ter no máximo 120 caracteres.");

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.");

// Mirrors supabase/config.toml's minimum_password_length=8 and
// password_requirements="letters_digits".
const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa conter pelo menos uma letra.")
  .regex(/[0-9]/, "A senha precisa conter pelo menos um número.");

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately not re-validated for length/composition here: a login attempt is
  // judged by whether it authenticates, not by whether it looks like a valid password.
  password: z.string().min(1, "Informe sua senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
