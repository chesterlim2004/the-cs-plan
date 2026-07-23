import { describe, expect, it } from "vitest";
import {
  csMathDoubleMajRequirementSet,
  csRequirementSet,
  getCompleteCsMathDoubleMajModuleRequirementTags
} from "@the-cs-plan/data";
import { RequirementSetSchema } from "@the-cs-plan/shared";

describe("Computer Science and Mathematics double-major seed data", () => {
  it("extends only Mathematics and Sciences and reduces UE for AY2025/26", () => {
    expect(() => RequirementSetSchema.parse(csMathDoubleMajRequirementSet)).not.toThrow();
    expect(csMathDoubleMajRequirementSet).toMatchObject({
      programme: "computer-science-mathematics-double-major",
      cohort: "AY2025/26",
      version: 2,
      totalUnits: 160
    });
    expect(
      csMathDoubleMajRequirementSet.rules.reduce(
        (sum, rule) => sum + (rule.requiredUnits ?? 0),
        0
      )
    ).toBe(160);

    const changedRuleIds = csMathDoubleMajRequirementSet.rules.flatMap((rule, index) =>
      JSON.stringify(rule) === JSON.stringify(csRequirementSet.rules[index]) ? [] : [rule.id]
    );
    expect(changedRuleIds).toEqual(["cs-math", "ue"]);
    expect(csMathDoubleMajRequirementSet.rules.find((rule) => rule.id === "cs-math"))
      .toMatchObject({
        type: "capped-units-from-tags",
        requiredUnits: 36,
        tagCaps: expect.arrayContaining([
          { tag: "cs-math-lower-level", maxUnits: 8 },
          { tag: "cs-math-upper-level", maxUnits: 12 }
        ])
      });
    expect(csMathDoubleMajRequirementSet.rules.find((rule) => rule.id === "ue"))
      .toMatchObject({ requiredUnits: 16 });
  });

  it("preserves CS mappings and adds all Mathematics second-major categories", () => {
    const mappings = getCompleteCsMathDoubleMajModuleRequirementTags([
      { moduleCode: "CS1231S" },
      { moduleCode: "MA1521" },
      { moduleCode: "MA2101S" },
      { moduleCode: "MA2108" },
      { moduleCode: "MA2216" },
      { moduleCode: "MA2288" },
      { moduleCode: "MA3201" },
      { moduleCode: "MA3289" },
      { moduleCode: "ST3236" },
      { moduleCode: "PC3274A" },
      { moduleCode: "ZZ9999" }
    ]);
    const tagsFor = (moduleCode: string) =>
      mappings.find((mapping) => mapping.moduleCode === moduleCode)?.tags ?? [];

    expect(tagsFor("CS1231S")).toContain("cs-foundation");
    expect(tagsFor("MA1521")).toContain("cs-math-lower-level");
    expect(tagsFor("MA2101S")).toContain("cs-math-linear-algebra-2");
    expect(tagsFor("MA2108")).toContain("cs-math-analysis-1");
    expect(tagsFor("MA2216")).toEqual(expect.arrayContaining([
      "cs-math-lower-level",
      "cs-math-calculus-option",
      "cs-math-probability"
    ]));
    expect(tagsFor("MA2288")).toEqual(["ue"]);
    expect(tagsFor("MA3201")).toContain("cs-math-upper-level");
    expect(tagsFor("MA3289")).toEqual(["ue"]);
    expect(tagsFor("ST3236")).toContain("cs-math-upper-level");
    expect(tagsFor("PC3274A")).toEqual(["cs-math-upper-level"]);
    expect(tagsFor("ZZ9999")).toEqual(["ue"]);
  });
});
