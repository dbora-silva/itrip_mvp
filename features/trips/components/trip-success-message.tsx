"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Only these three exact values are ever rendered — the query param's *value* is never
// reflected as text, only used as a lookup key into this fixed table. An unknown key
// (KNOWN_PARAMS.find() finds nothing) renders nothing at all, never a raw/arbitrary
// string from the URL.
const SUCCESS_MESSAGES = {
  criado: "Viagem criada com sucesso.",
  editado: "Alterações salvas com sucesso.",
  excluido: "Viagem excluída com sucesso.",
} as const;

const KNOWN_PARAMS = Object.keys(SUCCESS_MESSAGES) as (keyof typeof SUCCESS_MESSAGES)[];

/**
 * Reads a known `?criado=1` / `?editado=1` / `?excluido=1` param, shows the matching
 * message, then strips *only that param* from the URL — never a full refresh, and every
 * other query param (q, status, ...) is preserved untouched.
 *
 * `matchedParam` is captured once via useState's lazy initializer (evaluated during the
 * first render, not inside an effect) rather than re-derived from `searchParams` on every
 * render: once the effect below calls router.replace() and the param disappears from the
 * URL, a plain reactive derivation would make the message vanish immediately instead of
 * staying visible. The effect itself never calls setState — it only performs the
 * router.replace() side effect, which is what an effect is actually for here.
 */
export function TripSuccessMessage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [matchedParam] = useState(() =>
    KNOWN_PARAMS.find((param) => searchParams.get(param) === "1"),
  );

  useEffect(() => {
    if (!matchedParam) return;

    const remaining = new URLSearchParams(searchParams.toString());
    remaining.delete(matchedParam);
    const query = remaining.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!matchedParam) return null;

  return (
    <p role="status" className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
      {SUCCESS_MESSAGES[matchedParam]}
    </p>
  );
}
