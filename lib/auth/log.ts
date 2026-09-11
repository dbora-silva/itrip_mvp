/**
 * Logs auth failures with only: operation name, a coarse error category, and an
 * optional correlation id. Never the error's `.message` (some error text could
 * theoretically echo caller-supplied input), never the caught value itself, and never
 * anything the caller passes beyond these — there is no parameter for form data, tokens,
 * cookies, or full Supabase response objects, so it cannot be misused to leak them.
 */
export function logAuthError(operation: string, error: unknown, correlationId?: string): void {
  const category = classifyError(error);
  console.error(
    JSON.stringify({
      scope: "auth",
      operation,
      category,
      ...(correlationId ? { correlationId } : {}),
    }),
  );
}

function classifyError(error: unknown): string {
  if (isRecord(error) && typeof error.code === "string" && error.code.length > 0) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
