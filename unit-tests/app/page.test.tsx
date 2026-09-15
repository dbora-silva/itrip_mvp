import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders a single main heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Planeje hoje. Viaje melhor." }),
    ).toBeInTheDocument();
  });

  it("links the header actions to signup and login", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("links the hero actions to signup and login", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Planejar minha viagem" })).toHaveAttribute(
      "href",
      "/cadastro",
    );
    expect(screen.getByRole("link", { name: "Já tenho uma conta" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
