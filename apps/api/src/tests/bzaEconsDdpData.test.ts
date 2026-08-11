import { describe, expect, it } from "vitest";
import {
  bzaEconsDdpModuleRequirementTags,
  bzaEconsDdpRequirementSet,
  getCompleteBzaEconsDdpModuleRequirementTags
} from "@the-cs-plan/data";
import { RequirementSetSchema } from "@the-cs-plan/shared";

describe("Business Analytics and Economics DDP seed data", () => {
  it("defines a valid AY2025/26 requirement set with a 172-unit minimum", () => {
    expect(() => RequirementSetSchema.parse(bzaEconsDdpRequirementSet)).not.toThrow();
    expect(bzaEconsDdpRequirementSet).toMatchObject({
      programme: "business-analytics-economics-double-degree",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 172
    });
    expect(
      bzaEconsDdpRequirementSet.rules.reduce(
        (sum, rule) => sum + (rule.requiredUnits ?? (rule.requiredModules?.length ?? 0) * 4),
        0
      )
    ).toBe(172);
  });

  it("models both honours routes and their route-dependent thresholds", () => {
    expect(
      bzaEconsDdpRequirementSet.rules.find((rule) => rule.id === "honours-pathway")
    ).toMatchObject({
      type: "structured-ddp-honours-pathway",
      requiredUnits: 28,
      integratedThesisUnits: 12,
      integratedEconomicsUnits: 16,
      integratedEconomicsLevel4000Units: 8,
      internshipEconomicsUnits: 28,
      internshipEconomicsLevel4000Units: 20,
      internshipPathwayRequiredUnits: 40
    });
  });

  it("contains the fixed and Business Analytics elective mappings", () => {
    expect(bzaEconsDdpModuleRequirementTags).toContainEqual(expect.objectContaining({
      moduleCode: "BT4103",
      tags: expect.arrayContaining(["bza-econs-ddp-bza-core"])
    }));
    expect(bzaEconsDdpModuleRequirementTags).toContainEqual(expect.objectContaining({
      moduleCode: "BT4301",
      tags: expect.arrayContaining([
        "bza-econs-ddp-bza-programme-elective",
        "bza-econs-ddp-ier-supplementary"
      ])
    }));
  });

  it("generates CHS and Economics elective tags from the module catalogue", () => {
    const mappings = getCompleteBzaEconsDdpModuleRequirementTags([
      { moduleCode: "GEN2050" },
      { moduleCode: "HSI2014" },
      { moduleCode: "HS2901" },
      { moduleCode: "UTW1001A" },
      { moduleCode: "EC3366" },
      { moduleCode: "EC4301" },
      { moduleCode: "CS9999" }
    ]);

    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "GEN2050",
      tags: expect.arrayContaining(["bza-econs-ddp-communities-engagement"])
    }));
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "HS2901",
      tags: expect.arrayContaining([
        "bza-econs-ddp-interdisciplinary-1",
        "bza-econs-ddp-interdisciplinary-2"
      ])
    }));
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "UTW1001A",
      tags: expect.arrayContaining(["bza-econs-ddp-writing"])
    }));
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "EC4301",
      tags: expect.arrayContaining([
        "bza-econs-ddp-economics-elective",
        "bza-econs-ddp-economics-level4000"
      ])
    }));
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "CS9999",
      tags: ["ue"]
    }));
  });
});
