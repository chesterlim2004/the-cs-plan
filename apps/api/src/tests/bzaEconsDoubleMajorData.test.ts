import { describe, expect, it } from "vitest";
import {
  bzaEconsDoubleMajorModuleRequirementTags,
  bzaEconsDoubleMajorRequirementSet,
  getCompleteBzaEconsDoubleMajorModuleRequirementTags
} from "@the-cs-plan/data";
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

  it("maps BZA and Economics modules to the double major curriculum", () => {
    expect(bzaEconsDoubleMajorModuleRequirementTags.find((mapping) => mapping.moduleCode === "BT4103"))
      .toMatchObject({
        programme: "business-analytics-economics-double-major",
        cohort: "AY2025/26",
        tags: expect.arrayContaining(["ba-core"])
      });
    expect(bzaEconsDoubleMajorModuleRequirementTags.find((mapping) => mapping.moduleCode === "EC2101"))
      .toMatchObject({
        tags: expect.arrayContaining(["bza-econs-dm-economics-core"])
      });
    expect(bzaEconsDoubleMajorModuleRequirementTags.find((mapping) => mapping.moduleCode === "ST3131"))
      .toMatchObject({
        tags: expect.arrayContaining([
          "bza-econs-dm-economics-elective",
          "bza-econs-dm-economics-level3000-elective"
        ])
      });
  });

  it("generates EC-coded elective mappings from the module catalogue", () => {
    const mappings = getCompleteBzaEconsDoubleMajorModuleRequirementTags([
      { moduleCode: "EC3371" },
      { moduleCode: "EC4880A" }
    ]);

    expect(mappings.find((mapping) => mapping.moduleCode === "EC3371"))
      .toMatchObject({
        tags: expect.arrayContaining([
          "bza-econs-dm-economics-elective",
          "bza-econs-dm-economics-level3000-elective"
        ])
      });
    expect(mappings.find((mapping) => mapping.moduleCode === "EC4880A"))
      .toMatchObject({
        tags: expect.arrayContaining([
          "bza-econs-dm-economics-elective",
          "bza-econs-dm-economics-level3000-elective"
        ])
      });
  });

  it("inherits generated BZA classifications and maps unclassified modules as UE", () => {
    const mappings = getCompleteBzaEconsDoubleMajorModuleRequirementTags([
      { moduleCode: "GEX1015" },
      { moduleCode: "PC1141" },
      { moduleCode: "CS9999" }
    ]);

    expect(mappings.find((mapping) => mapping.moduleCode === "GEX1015"))
      .toMatchObject({ tags: ["critique-and-expression"] });
    expect(mappings.find((mapping) => mapping.moduleCode === "PC1141"))
      .toMatchObject({ tags: ["cd"] });
    expect(mappings.find((mapping) => mapping.moduleCode === "CS9999"))
      .toMatchObject({ tags: ["ue"] });
  });
});
