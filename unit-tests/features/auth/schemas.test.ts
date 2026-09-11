import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/features/auth/schemas";

describe("signupSchema", () => {
  const valid = {
    name: "Debora Silva",
    email: "debora@example.test",
    password: "Senha1234",
    confirmPassword: "Senha1234",
  };

  it("accepts a valid signup", () => {
    const result = signupSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = signupSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name containing only spaces", () => {
    const result = signupSchema.safeParse({ ...valid, name: "    " });
    expect(result.success).toBe(false);
  });

  it("trims external spaces from the name", () => {
    const result = signupSchema.safeParse({ ...valid, name: "  Debora Silva  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Debora Silva");
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("normalizes email: trims spaces and lowercases", () => {
    const result = signupSchema.safeParse({ ...valid, email: "  Debora@Example.TEST  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("debora@example.test");
  });

  it("rejects a password below the minimum length", () => {
    const result = signupSchema.safeParse({
      ...valid,
      password: "Sh0rt1",
      confirmPassword: "Sh0rt1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password with only letters", () => {
    const result = signupSchema.safeParse({
      ...valid,
      password: "SomenteLetras",
      confirmPassword: "SomenteLetras",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password with only digits", () => {
    const result = signupSchema.safeParse({
      ...valid,
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "Outra1234" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });
});

describe("loginSchema", () => {
  it("accepts a valid login", () => {
    const result = loginSchema.safeParse({ email: "debora@example.test", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("normalizes email: trims spaces and lowercases", () => {
    const result = loginSchema.safeParse({ email: "  Debora@Example.TEST  ", password: "x" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("debora@example.test");
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "debora@example.test", password: "" });
    expect(result.success).toBe(false);
  });
});
