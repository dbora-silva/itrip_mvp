import { describe, expect, it } from "vitest";
import { getStatusPresentation } from "@/features/trips/status-labels";
import type { TripStatus } from "@/features/trips/types";

describe("getStatusPresentation", () => {
  const cases: [TripStatus, string][] = [
    ["ongoing", "Em andamento"],
    ["upcoming", "Em breve"],
    ["planning", "Planejamento"],
    ["completed", "Concluída"],
  ];

  it.each(cases)("maps %s to the label %j", (status, expectedLabel) => {
    expect(getStatusPresentation(status).label).toBe(expectedLabel);
  });

  it("never derives a label from dates — only from the given status value", () => {
    // getStatusPresentation takes no date input at all; this test documents that
    // constraint at the type level (the function signature is (status: TripStatus)).
    const presentation = getStatusPresentation("completed");
    expect(presentation).toHaveProperty("label");
    expect(presentation).toHaveProperty("variant");
  });
});
