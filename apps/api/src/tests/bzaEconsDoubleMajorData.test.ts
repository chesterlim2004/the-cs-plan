import { describe, expect, it } from "vitest";
import { bzaEconsDoubleMajorRequirementSet } from "@the-cs-plan/data/src/bzaEconsDoubleMajorData.js";
import { RequirementSetSchema } from "@the-cs-plan/shared";

describe("BZA Economics double major data", () => {
  it("defines the AY2025/26 requirement set", () => {
    expect(() => RequirementSetSchema.parse(bzaEconsDoubleMajorRequirementSet)).not.toThrow();
    expect(bzaEconsDoubleMajorRequirementSet).toMatchObject({
      programme: "business-analytics-economics-double-major",
      cohort: "AY2025/26",
      totalUnits: 160,
      sourceNote: "NUS BZA and Econs Double Major Curriculum AY25/26",
      redirectLink: "https://fass.nus.edu.sg/ecs/requirements-for-economics-major/"
    });
  });

  it("replaces unrestricted electives with Economics second major requirements", () => {
    expect(bzaEconsDoubleMajorRequirementSet.rules.some((rule) => rule.id === "ue")).toBe(false);
    expect(bzaEconsDoubleMajorRequirementSet.rules.find((rule) => rule.id === "economics-second-major-core"))
      .toMatchObject({
        type: "module-list",
        requiredUnits: 32,
        requiredModules: [
          "EC1101E",
          "EC2101",
          "EC2102",
          "EC2104",
          "EC2303",
          "EC3101",
          "EC3102",
          "EC3303"
        ]
      });
    expect(bzaEconsDoubleMajorRequirementSet.rules.find((rule) => rule.id === "economics-second-major-upper-elective"))
      .toMatchObject({
        type: "units-from-tags",
        requiredUnits: 4,
        acceptedTags: ["bza-econs-dm-economics-level3000-elective"]
      });
    expect(bzaEconsDoubleMajorRequirementSet.rules.find((rule) => rule.id === "economics-second-major-elective"))
      .toMatchObject({
        type: "units-from-tags",
        requiredUnits: 4,
        acceptedTags: ["bza-econs-dm-economics-elective"]
      });
  });
});
