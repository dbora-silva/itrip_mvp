"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStatusPresentation } from "@/features/trips/status-labels";
import type { TripFilters, TripStatus } from "@/features/trips/types";

const ALL_STATUSES = "all";
const STATUS_OPTIONS: TripStatus[] = ["ongoing", "upcoming", "planning", "completed"];

export function TripFilters({ filters }: { filters: TripFilters }) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? "");
  const [status, setStatus] = useState<string>(filters.status ?? ALL_STATUSES);
  const hasActiveFilters = Boolean(filters.q) || Boolean(filters.status);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim().length > 0) params.set("q", q.trim());
    if (status !== ALL_STATUSES) params.set("status", status);
    const query = params.toString();
    router.push(query.length > 0 ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:gap-4"
    >
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="trip-search">Buscar por nome ou destino</Label>
        <Input
          id="trip-search"
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="trip-status-filter">Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(String(value))}>
          <SelectTrigger id="trip-status-filter" className="w-full sm:w-40">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>Todos</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {getStatusPresentation(option).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3">
        <Button type="submit" className="flex-1 sm:flex-initial">
          Filtrar
        </Button>
        {hasActiveFilters && (
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", className: "flex-1 sm:flex-initial" })}
          >
            Limpar filtros
          </Link>
        )}
      </div>
    </form>
  );
}
