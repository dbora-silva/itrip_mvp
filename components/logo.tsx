import { CompassIcon } from "lucide-react";

export function Logo() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <CompassIcon className="size-4" aria-hidden="true" />
    </span>
  );
}
