import { describe, expect, it } from "vitest";
import {
  businessAnalyticsModuleRequirementTags,
  businessAnalyticsRequirementSet,
  getCompleteBusinessAnalyticsModuleRequirementTags
} from "@the-cs-plan/data";
import { RequirementSetSchema } from "@the-cs-plan/shared";

describe("business analytics seed data", () => {
  it("defines a valid AY2025/26 160-unit curriculum", () => {
    expect(() => RequirementSetSchema.parse(businessAnalyticsRequirementSet)).not.toThrow();
    expect(businessAnalyticsRequirementSet).toMatchObject({
      programme: "business-analytics",
      cohort: "AY2025/26",
      version: 3,
      totalUnits: 160
    });
    expect(
      businessAnalyticsRequirementSet.rules.reduce(
        (total, rule) => total + (rule.requiredUnits ?? 0),
        0
      )
    ).toBe(160);
  });

  it("captures the official statistics, programme-elective, and industry pathways", () => {
    expect(
      businessAnalyticsRequirementSet.rules.find((rule) => rule.id === "probability-statistics")
    ).toMatchObject({
      type: "module-choice",
      moduleOptions: [
        ["ST2334"],
        ["ST2131", "ST2132"],
        ["MA2116", "ST2132"],
        ["MA2116T", "ST2132"]
      ]
    });

    expect(
      businessAnalyticsRequirementSet.rules.find((rule) => rule.id === "programme-electives")
    ).toMatchObject({
      type: "structured-programme-electives",
      requiredUnits: 20,
      requiredMinCourses: 5,
      requiredLevel4000MinCourses: 3,
      requiredPrefixMinCourses: 3,
      requiredPrefixes: ["BT"]
    });

    expect(
      businessAnalyticsRequirementSet.rules.find((rule) => rule.id === "industry-experience")
    ).toMatchObject({
      type: "structured-industry-experience",
      requiredUnits: 12,
      requiredFoundationUnits: 6,
      requiredCompanionUnits: 6
    });
  });

  it("maps every listed programme elective and generates common-curriculum tags", () => {
    const programmeElectives = businessAnalyticsModuleRequirementTags.filter((mapping) =>
      mapping.tags.includes("ba-programme-elective")
    );
    expect(programmeElectives).toHaveLength(37);
    expect(businessAnalyticsModuleRequirementTags).toContainEqual(expect.objectContaining({
      moduleCode: "ETP3203L",
      tags: expect.arrayContaining(["ba-ier-dissertation-4", "ba-programme-elective"])
    }));

    const mappings = getCompleteBusinessAnalyticsModuleRequirementTags([
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
