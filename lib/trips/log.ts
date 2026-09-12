/**
 * Same shape and rationale as lib/auth/log.ts, scoped to "trips" instead of "auth" — kept
 * as a separate, near-identical file rather than a shared generic (the two features were
 * approved independently and this is the only place they'd otherwise touch each other).
 * Logs only: operation name, a coarse error category, an optional correlation id. Never
 * `.message`, never the caught value itself, never form data or a raw Supabase response.
 */
export function logTripsError(operation: string, error: unknown, correlationId?: string): void {
  const category = classifyError(error);
  console.error(
    JSON.stringify({
      scope: "trips",
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
