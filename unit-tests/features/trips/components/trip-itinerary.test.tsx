import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TripItinerary } from "@/features/trips/components/trip-itinerary";

describe("TripItinerary", () => {
  it("renders HTML-looking content as literal text, never as markup", () => {
    const malicious = '<script>window.__pwned = true;</script><img src=x onerror="alert(1)">';
    const { container } = render(
      <TripItinerary tripId="b6857da0-d3f8-4575-8c80-a561d26beeca" itinerary={malicious} />,
    );

    // The exact string appears as visible text...
    expect(screen.getByText(malicious)).toBeInTheDocument();
    // ...and, critically, no actual <script> or <img> element was created from it — if
    // this were ever rendered via dangerouslySetInnerHTML, these queries would find real
    // elements instead of failing.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect((globalThis as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it("preserves line breaks via CSS (whitespace-pre-wrap), not injected <br> markup", () => {
    const multiline = "Dia 1: chegada\nDia 2: passeio\nDia 3: volta";
    render(<TripItinerary tripId="b6857da0-d3f8-4575-8c80-a561d26beeca" itinerary={multiline} />);
    const paragraph = screen.getByText((_, element) => element?.textContent === multiline);
    expect(paragraph).toHaveClass("whitespace-pre-wrap");
    expect(paragraph.innerHTML).not.toContain("<br");
  });

  it("shows a discreet empty state with a link to edit when there is no itinerary", () => {
    render(<TripItinerary tripId="b6857da0-d3f8-4575-8c80-a561d26beeca" itinerary={null} />);
    expect(screen.getByText("Nenhum roteiro adicionado ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adicionar roteiro" })).toHaveAttribute(
      "href",
      "/dashboard/viagens/b6857da0-d3f8-4575-8c80-a561d26beeca/editar",
    );
  });

  it("renders the section heading", () => {
    render(<TripItinerary tripId="b6857da0-d3f8-4575-8c80-a561d26beeca" itinerary={null} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Roteiro da viagem" }),
    ).toBeInTheDocument();
  });
});
