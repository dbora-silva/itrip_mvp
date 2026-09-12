import { z } from "zod";
import { isValidCivilDate } from "@/lib/dates/civil-date";

// Plain string end to end (see lib/dates/civil-date.ts) — never z.coerce.date(), so the
// value that reaches the DB `date` column is exactly what the user typed, with no
// timezone-driven shift possible.
const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.")
  .refine(isValidCivilDate, "Informe uma data válida.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome da viagem.")
  .max(120, "O nome pode ter no máximo 120 caracteres.");

const destinationSchema = z
  .string()
  .trim()
  .min(1, "Informe o destino.")
  .max(120, "O destino pode ter no máximo 120 caracteres.");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "A descrição pode ter no máximo 2000 caracteres.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

// .trim() only trims the leading/trailing edges of the whole string — internal line
// breaks are untouched, so a multi-line itinerary round-trips exactly as typed.
const itinerarySchema = z
  .string()
  .trim()
  .max(10000, "O roteiro pode ter no máximo 10.000 caracteres.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

// strictObject: a payload carrying an unexpected key (status, owner_id, id, ...) fails
// validation instead of the extra key being silently dropped — see docs/security.md,
// Phase 6 section, on why "Zod strips unknown keys by default" isn't enough on its own:
// actions.ts still never spreads parsed.data into the Supabase call either way, but this
// makes an injection *attempt* a reported field error instead of a no-op that succeeds
// quietly with the extra data just ignored.
export const tripFormSchema = z
  .strictObject({
    name: nameSchema,
    destination: destinationSchema,
    description: descriptionSchema,
    itinerary: itinerarySchema,
    start_date: civilDateSchema,
    end_date: civilDateSchema,
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "A data final não pode ser anterior à inicial.",
    path: ["end_date"],
  });

// Two distinct types on purpose: the schema's `description` field is transformed
// (empty/absent -> null), so its *input* shape (what the <textarea> actually holds —
// string | undefined) differs from its *output* shape (what the Server Action receives —
// string | null). zodResolver's return type reflects exactly this split; trip-form.tsx
// uses TripFormFieldValues for the form's own state and TripFormInput for onSubmit's
// parameter and the action calls.
export type TripFormFieldValues = z.input<typeof tripFormSchema>;
export type TripFormInput = z.infer<typeof tripFormSchema>;

export const uuidSchema = z.uuid();

const TRIP_STATUS_VALUES = ["planning", "upcoming", "ongoing", "completed"] as const;

// .catch(undefined): an unrecognized status is treated as "no filter", not an error —
// see docs/security.md / the Phase 6 plan on why filters degrade gracefully.
const statusFilterSchema = z.enum(TRIP_STATUS_VALUES).optional().catch(undefined);

const searchTermSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .catch(undefined);

export const tripFiltersSchema = z.object({
  q: searchTermSchema,
  status: statusFilterSchema,
});

export type TripFiltersInput = z.infer<typeof tripFiltersSchema>;
