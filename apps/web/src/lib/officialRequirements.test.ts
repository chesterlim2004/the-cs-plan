import { describe, expect, it } from "vitest";
import type { Cohort, Programme } from "@the-cs-plan/shared";
import { getOfficialRequirementsUrl } from "./officialRequirements";

describe("getOfficialRequirementsUrl", () => {
  it("returns official URLs for configured curricula", () => {
    expect(getOfficialRequirementsUrl("computer-science", "AY2025/26")).toBe(
      "https://www.comp.nus.edu.sg/cug/per-cohort/cs/cs-25-26/"
    );
    expect(getOfficialRequirementsUrl("computer-science", "AY2026/27")).toBe(
      "https://www.comp.nus.edu.sg/cug/per-cohort/cs/cs-26-27/"
    );
    expect(getOfficialRequirementsUrl("business-analytics", "AY2025/26")).toBe(
      "https://www.comp.nus.edu.sg/cug/per-cohort/ba/ba-25-26/"
    );
    expect(getOfficialRequirementsUrl("business-artificial-intelligence-systems", "AY2025/26")).toBe(
      "https://www.comp.nus.edu.sg/cug/per-cohort/bais/bais-25-26/"
    );
    expect(getOfficialRequirementsUrl("business-analytics-economics-double-degree", "AY2025/26")).toBe(
      "https://www.comp.nus.edu.sg/cug/per-cohort/ddp-ba-econs/ddp-ba-econs-cohort-2025-2026/"
    );
    expect(getOfficialRequirementsUrl("computer-science-mathematics-double-major", "AY2025/26")).toBe(
      "https://www.math.nus.edu.sg/ug/ddp/"
    );
  });

  it("returns undefined when a curriculum has no configured official URL", () => {
    expect(getOfficialRequirementsUrl("business-analytics", "AY2026/27")).toBeUndefined();
    expect(
      getOfficialRequirementsUrl(
        "computer-science-mathematics-double-degree" as Programme,
        "AY2025/26" as Cohort
      )
    ).toBeUndefined();
  });
});
