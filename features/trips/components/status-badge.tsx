import { Badge } from "@/components/ui/badge";
import { getStatusPresentation } from "@/features/trips/status-labels";
import type { TripStatus } from "@/features/trips/types";

export function StatusBadge({ status }: { status: TripStatus }) {
  const { label, variant } = getStatusPresentation(status);
  return <Badge variant={variant}>{label}</Badge>;
}
