import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the iTrip heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "iTrip" })).toBeInTheDocument();
  });

  it("renders a disabled placeholder action", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: "Em breve" })).toBeDisabled();
  });
});
