import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the iTrip heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "iTrip" })).toBeInTheDocument();
  });

  it("links to signup and login", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });
});
