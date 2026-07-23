import { describe, expect, it } from "vitest";
import {
  csAy2025RequirementSet,
  csRequirementSet,
  getCompleteCsModuleRequirementTags
} from "@the-cs-plan/data";

describe("computer science seed data", () => {
  it("mirrors the latest AY2026/27 requirement set", () => {
    expect(csRequirementSet.cohort).toBe("AY2026/27");
    expect(csRequirementSet.version).toBe(1);

    const breadthAndDepthRule = csRequirementSet.rules.find(
      (rule) => rule.id === "cs-breadth-and-depth"
    );
    expect(breadthAndDepthRule?.focusAreas).toHaveLength(11);
    expect(breadthAndDepthRule?.focusAreas?.some(
      (area) => area.id === "human-computer-interaction"
    )).toBe(true);
  });

  it("exports the latest requirement set for both CS cohorts", () => {
    expect([
      [csAy2025RequirementSet.cohort, csAy2025RequirementSet.version],
      [csRequirementSet.cohort, csRequirementSet.version]
    ]).toEqual([
      ["AY2025/26", 2],
      ["AY2026/27", 1]
    ]);
    expect(csAy2025RequirementSet.rules).toEqual(csRequirementSet.rules);
  });

  it("maps every focus-area module for both CS cohorts", () => {
    const breadthAndDepthRule = csRequirementSet.rules.find(
      (rule) => rule.id === "cs-breadth-and-depth"
    );
    const focusModuleCodes = new Set(
      (breadthAndDepthRule?.focusAreas ?? []).flatMap((area) => [
        ...area.primaryModules,
        ...area.electiveModules
      ])
    );
    const mappings = getCompleteCsModuleRequirementTags([]);

    expect(focusModuleCodes.size).toBe(119);
    for (const cohort of ["AY2025/26", "AY2026/27"] as const) {
      for (const moduleCode of focusModuleCodes) {
        expect(mappings).toContainEqual(expect.objectContaining({
          programme: "computer-science",
          cohort,
          moduleCode,
          tags: expect.arrayContaining(["cs-breadth-and-depth"])
        }));
      }
    }
  });
});
