import { describe, expect, it } from "vitest";
import { getSuEligibility, type Module } from "@the-cs-plan/shared";

function module(overrides: Partial<Module> & Pick<Module, "moduleCode">): Module {
  return {
    acadYear: "2026-2027",
    title: overrides.moduleCode,
    units: 4,
    ...overrides
  };
}

describe("NUS S/U course eligibility", () => {
  it("allows Level-1000 courses even when they have non-course prerequisites", () => {
    expect(getSuEligibility(module({
      moduleCode: "CS1010S",
      prerequisite: "A-level Mathematics or equivalent"
    }), "AY2025/26")).toBe("eligible");
  });

  it("allows Level-2000 courses without NUS course prerequisites", () => {
    expect(getSuEligibility(module({
      moduleCode: "EC2101",
      prerequisite: "A-level Mathematics"
    }), "AY2025/26")).toBe("eligible");
  });

  it("rejects Level-2000 courses with NUS course prerequisites", () => {
    expect(getSuEligibility(module({
      moduleCode: "CS2102",
      prerequisite: "CS1010S or its equivalent",
      prereqTree: { or: ["CS1010S", "CS1010J"] }
    }), "AY2025/26")).toBe("ineligible");
  });

  it("allows the published Level-2000 exceptions", () => {
    expect(getSuEligibility(module({
      moduleCode: "MA2001",
      prerequisite: "MA1521"
    }), "AY2025/26")).toBe("eligible");
    expect(getSuEligibility(module({
      moduleCode: "CS2101",
      prerequisite: "CS2103T"
    }), "AY2025/26")).toBe("eligible");
    expect(getSuEligibility(module({
      moduleCode: "ST2334",
      prerequisite: "MA1312/MA1505/MA1511/MA1521/MA2002",
      prereqTree: {
        or: ["MA1312:D", "MA1505:D", "MA1511:D", "MA1521:D", "MA2002:D"]
      }
    }), "AY2025/26")).toBe("eligible");
  });

  it("allows Centre for Language Studies courses at every level", () => {
    expect(getSuEligibility(module({
      moduleCode: "LAC3204",
      title: "Chinese 4",
      department: "Centre for Language Studies"
    }), "AY2025/26")).toBe("eligible");
  });

  it("rejects Level-3000 courses and explicit policy exclusions", () => {
    expect(getSuEligibility(module({ moduleCode: "CS3230" }), "AY2025/26"))
      .toBe("ineligible");
    expect(getSuEligibility(module({ moduleCode: "UWC2101A" }), "AY2025/26"))
      .toBe("ineligible");
  });

  it("returns unknown when a course level cannot be derived", () => {
    expect(getSuEligibility(module({ moduleCode: "UNKNOWN" }), "AY2025/26"))
      .toBe("unknown");
  });
});
