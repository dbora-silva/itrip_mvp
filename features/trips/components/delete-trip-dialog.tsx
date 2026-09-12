"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteTrip } from "@/features/trips/actions";

const GENERIC_DELETE_ERROR = "Não foi possível excluir a viagem. Tente novamente.";

interface DeleteTripDialogProps {
  tripId: string;
  tripName: string;
  size?: "sm" | "default";
}

export function DeleteTripDialog({ tripId, tripName, size = "sm" }: DeleteTripDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      // Success ends in redirect() on the server (features/trips/actions.ts) and never
      // returns here — reaching this line at all means it failed. The dialog is
      // deliberately left open on failure: nothing here closes it, so the user sees the
      // error in place and can retry without re-opening or re-confirming from scratch.
      const result = await deleteTrip(tripId);
      if (result.status === "error") {
        setError(result.formError ?? GENERIC_DELETE_ERROR);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size={size} aria-label={`Excluir viagem ${tripName}`} />
        }
      >
        Excluir viagem
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir &ldquo;{tripName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação também removerá as tarefas dessa viagem e não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? "Excluindo…" : "Excluir viagem"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
