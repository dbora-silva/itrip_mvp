"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  tripFormSchema,
  type TripFormFieldValues,
  type TripFormInput,
} from "@/features/trips/schemas";
import { createTrip, updateTrip } from "@/features/trips/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TripFormProps {
  mode: "create" | "edit";
  tripId?: string;
  defaultValues?: TripFormFieldValues;
}

const ITINERARY_MAX_LENGTH = 10000;

const EMPTY_VALUES: TripFormFieldValues = {
  name: "",
  destination: "",
  description: "",
  itinerary: "",
  start_date: "",
  end_date: "",
};

export function TripForm({ mode, tripId, defaultValues }: TripFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TripFormFieldValues, unknown, TripFormInput>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: defaultValues ?? EMPTY_VALUES,
  });

  // useWatch (not the form's own watch()) so only this value's changes trigger a
  // re-render, scoped to the counter below — and because plain watch() returns a
  // function React Compiler cannot safely memoize (it flagged exactly that before this
  // change), which risked stale re-renders elsewhere in this component.
  const itineraryValue = useWatch({ control, name: "itinerary" });
  const itineraryLength = (itineraryValue ?? "").length;

  async function onSubmit(values: TripFormInput) {
    setFormError(null);
    // A successful create/edit ends in redirect() on the server and never returns here —
    // reaching this line at all means it failed (features/trips/actions.ts).
    const result =
      mode === "create" ? await createTrip(values) : await updateTrip(tripId as string, values);

    if (result.status === "error") {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          setError(field as keyof TripFormFieldValues, { message: messages[0] });
        }
      }
      if (result.formError) {
        setFormError(result.formError);
      }
    }
  }

  const submitLabel =
    mode === "create"
      ? isSubmitting
        ? "Criando…"
        : "Criar viagem"
      : isSubmitting
        ? "Salvando…"
        : "Salvar alterações";

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
        <Label htmlFor="trip-name">Nome da viagem</Label>
        <Input
          id="trip-name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "trip-name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="trip-name-error" role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="trip-destination">Destino</Label>
        <Input
          id="trip-destination"
          aria-invalid={errors.destination ? true : undefined}
          aria-describedby={errors.destination ? "trip-destination-error" : undefined}
          {...register("destination")}
        />
        {errors.destination && (
          <p id="trip-destination-error" role="alert" className="text-sm text-destructive">
            {errors.destination.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="trip-start-date">Data inicial</Label>
          <Input
            id="trip-start-date"
            type="date"
            aria-invalid={errors.start_date ? true : undefined}
            aria-describedby={errors.start_date ? "trip-start-date-error" : undefined}
            {...register("start_date")}
          />
          {errors.start_date && (
            <p id="trip-start-date-error" role="alert" className="text-sm text-destructive">
              {errors.start_date.message}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="trip-end-date">Data final</Label>
          <Input
            id="trip-end-date"
            type="date"
            aria-invalid={errors.end_date ? true : undefined}
            aria-describedby={errors.end_date ? "trip-end-date-error" : undefined}
            {...register("end_date")}
          />
          {errors.end_date && (
            <p id="trip-end-date-error" role="alert" className="text-sm text-destructive">
              {errors.end_date.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="trip-description">Descrição (opcional)</Label>
        <Textarea
          id="trip-description"
          rows={4}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "trip-description-error" : undefined}
          {...register("description")}
        />
        {errors.description && (
          <p id="trip-description-error" role="alert" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="trip-itinerary">Roteiro da viagem (opcional)</Label>
        <Textarea
          id="trip-itinerary"
          rows={8}
          maxLength={ITINERARY_MAX_LENGTH}
          aria-invalid={errors.itinerary ? true : undefined}
          aria-describedby={
            errors.itinerary ? "trip-itinerary-help trip-itinerary-error" : "trip-itinerary-help"
          }
          {...register("itinerary")}
        />
        <div className="flex items-start justify-between gap-2">
          <p id="trip-itinerary-help" className="text-xs text-muted-foreground">
            Inclua passeios, reservas e observações para esta viagem.
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {itineraryLength}/{ITINERARY_MAX_LENGTH}
          </span>
        </div>
        {errors.itinerary && (
          <p id="trip-itinerary-error" role="alert" className="text-sm text-destructive">
            {errors.itinerary.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
