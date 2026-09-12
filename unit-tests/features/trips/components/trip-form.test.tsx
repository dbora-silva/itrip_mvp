import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TripForm } from "@/features/trips/components/trip-form";

// features/trips/actions.ts is a "use server" module — mocked here so this stays a pure
// client-render test, not an accidental integration test.
vi.mock("@/features/trips/actions", () => ({
  createTrip: vi.fn(),
  updateTrip: vi.fn(),
}));

describe("TripForm", () => {
  it("renders empty fields in create mode", () => {
    render(<TripForm mode="create" />);
    expect(screen.getByLabelText("Nome da viagem")).toHaveValue("");
    expect(screen.getByLabelText("Destino")).toHaveValue("");
    expect(screen.getByLabelText("Roteiro da viagem (opcional)")).toHaveValue("");
    expect(screen.getByText("0/10000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar viagem" })).toBeInTheDocument();
  });

  it("prefills every field from defaultValues in edit mode, including the itinerary", () => {
    render(
      <TripForm
        mode="edit"
        tripId="b6857da0-d3f8-4575-8c80-a561d26beeca"
        defaultValues={{
          name: "Trilha na Patagônia",
          destination: "El Chaltén",
          description: "Trekking de 5 dias",
          itinerary: "Dia 1: chegada\nDia 2: trilha",
          start_date: "2026-09-26",
          end_date: "2026-10-06",
        }}
      />,
    );
    expect(screen.getByLabelText("Nome da viagem")).toHaveValue("Trilha na Patagônia");
    expect(screen.getByLabelText("Destino")).toHaveValue("El Chaltén");
    expect(screen.getByLabelText("Descrição (opcional)")).toHaveValue("Trekking de 5 dias");
    expect(screen.getByLabelText("Roteiro da viagem (opcional)")).toHaveValue(
      "Dia 1: chegada\nDia 2: trilha",
    );
    expect(screen.getByLabelText("Data inicial")).toHaveValue("2026-09-26");
    expect(screen.getByLabelText("Data final")).toHaveValue("2026-10-06");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("updates the visible character counter as the itinerary is typed", () => {
    render(<TripForm mode="create" />);
    const itineraryField = screen.getByLabelText("Roteiro da viagem (opcional)");
    fireEvent.change(itineraryField, { target: { value: "Dia 1: chegada" } });
    expect(screen.getByText("14/10000")).toBeInTheDocument();
  });

  it("associates the itinerary field with its help text via aria-describedby", () => {
    render(<TripForm mode="create" />);
    const itineraryField = screen.getByLabelText("Roteiro da viagem (opcional)");
    expect(itineraryField).toHaveAttribute("aria-describedby", "trip-itinerary-help");
    expect(
      screen.getByText("Inclua passeios, reservas e observações para esta viagem."),
    ).toHaveAttribute("id", "trip-itinerary-help");
  });
});
