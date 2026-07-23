import { describe, expect, it } from "vitest";
import {
  baisModuleRequirementTags,
  baisRequirementSet,
  getCompleteBaisModuleRequirementTags
} from "@the-cs-plan/data";
import { RequirementSetSchema } from "@the-cs-plan/shared";

describe("BAIS seed data", () => {
  it("defines a valid AY2025/26 160-unit curriculum", () => {
    expect(() => RequirementSetSchema.parse(baisRequirementSet)).not.toThrow();
    expect(baisRequirementSet).toMatchObject({
      programme: "business-artificial-intelligence-systems",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 160
    });
    expect(
      baisRequirementSet.rules.reduce(
        (total, rule) => total + (rule.requiredUnits ?? 0),
        0
      )
    ).toBe(160);
  });

  it("captures the official core, programme-elective, and industry constraints", () => {
    expect(baisRequirementSet.rules.find((rule) => rule.id === "bais-core")).toMatchObject({
      type: "module-list",
      requiredUnits: 48,
      requiredModules: expect.arrayContaining([
        "BT2102",
        "IS2108",
        "IS2109",
        "IS4108",
        "ST2334"
      ])
    });
    expect(
      baisRequirementSet.rules.find((rule) => rule.id === "programme-electives")
    ).toMatchObject({
      type: "structured-programme-electives",
      requiredUnits: 20,
      requiredMinCourses: 5,
      requiredLevel4000MinCourses: 3,
      requiredPrefixMinCourses: 0
    });
    expect(
      baisRequirementSet.rules.find((rule) => rule.id === "industry-experience")
    ).toMatchObject({
      type: "structured-industry-experience",
      requiredUnits: 12,
      requiredFoundationUnits: 6,
      requiredCompanionUnits: 6,
      dissertationTags: expect.arrayContaining(["bais-ier-dissertation"])
    });
  });

  it("maps all listed electives and generates common-curriculum and UE tags", () => {
    const standardElectives = baisModuleRequirementTags.filter((mapping) =>
      mapping.tags.includes("bais-programme-elective")
      && mapping.moduleCode !== "ETP3203L"
    );
    expect(standardElectives).toHaveLength(40);
    expect(baisModuleRequirementTags).toContainEqual(expect.objectContaining({
      moduleCode: "ETP3203L",
      tags: expect.arrayContaining(["bais-ier-dissertation-4", "bais-programme-elective"])
    }));
    expect(baisModuleRequirementTags).toContainEqual(expect.objectContaining({
      moduleCode: "IS4301",
      tags: expect.arrayContaining(["bais-programme-elective", "bais-ier-supplementary"])
    }));

    const mappings = getCompleteBaisModuleRequirementTags([
      { moduleCode: "GEX1000" },
      { moduleCode: "GEN2000" },
      { moduleCode: "PC1001" },
      { moduleCode: "ZZ9999" }
    ]);
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "GEX1000",
      tags: expect.arrayContaining(["critique-and-expression"])
    }));
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "GEN2000",
      tags: expect.arrayContaining(["communities-and-engagement"])
    }));
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "PC1001",
      tags: expect.arrayContaining(["cd"])
    }));
    expect(mappings).toContainEqual(expect.objectContaining({
      moduleCode: "ZZ9999",
      tags: ["ue"]
    }));
  });
});
