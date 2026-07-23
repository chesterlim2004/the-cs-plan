import { describe, expect, it } from "vitest";
import {
  AdminCloneCurriculumSchema,
  AdminCurriculumDraftSchema,
  CohortSchema,
  type AdminCurriculumDraft
} from "@the-cs-plan/shared";
import { validateDraftSemantics } from "../services/adminCurriculumService.js";

const validDraft: AdminCurriculumDraft = {
  programme: "computer-science",
  cohort: "AY2026/27",
  baseVersion: 0,
  totalUnits: 8,
  sourceNote: "Test curriculum",
  rules: [
    {
      id: "foundation",
      label: "Foundation",
      type: "module-list",
      requiredModules: ["CS1101S"]
    },
    {
      id: "electives",
      label: "Electives",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["ue"]
    }
  ],
  tagChanges: [{ moduleCode: "CS1101S", tags: ["cs-foundation"] }]
};

describe("admin curriculum contracts", () => {
  it("accepts consecutive academic-year cohorts", () => {
    expect(CohortSchema.parse("AY2026/27")).toBe("AY2026/27");
    expect(CohortSchema.safeParse("AY2026/28").success).toBe(false);
    expect(CohortSchema.safeParse("2026/27").success).toBe(false);
  });

  it("normalizes staged module tags", () => {
    const parsed = AdminCurriculumDraftSchema.parse({
      ...validDraft,
      tagChanges: [{ moduleCode: "cs1101s", tags: ["CS-Foundation", "cs-foundation"] }]
    });

    expect(parsed.tagChanges).toEqual([
      { moduleCode: "CS1101S", tags: ["cs-foundation"] }
    ]);
  });

  it("accepts a staged module mapping deletion", () => {
    const parsed = AdminCurriculumDraftSchema.parse({
      ...validDraft,
      tagChanges: [{ moduleCode: "cs1101s", tags: [], deleteMapping: true }]
    });

    expect(parsed.tagChanges).toEqual([
      { moduleCode: "CS1101S", tags: [], deleteMapping: true }
    ]);
  });

  it("rejects cloning a curriculum onto itself", () => {
    const result = AdminCloneCurriculumSchema.safeParse({
      sourceProgramme: "computer-science",
      sourceCohort: "AY2025/26",
      targetProgramme: "computer-science",
      targetCohort: "AY2025/26"
    });

    expect(result.success).toBe(false);
  });
});

describe("admin curriculum semantic validation", () => {
  it("accepts a complete draft with known modules", () => {
    expect(validateDraftSemantics(validDraft, new Set(["CS1101S"]))).toEqual([]);
  });

  it("reports duplicate rules, missing fields, and unknown modules", () => {
    const invalidDraft: AdminCurriculumDraft = {
      ...validDraft,
      rules: [
        ...validDraft.rules,
        {
          id: "foundation",
          label: "Broken duplicate",
          type: "structured-breadth-depth",
          requiredUnits: 32,
          acceptedTags: []
        }
      ],
      tagChanges: [
        { moduleCode: "UNKNOWN1000", tags: ["ue"] },
        { moduleCode: "UNKNOWN1000", tags: ["cs-foundation"] }
      ]
    };

    const errors = validateDraftSemantics(invalidDraft, new Set(["CS1101S"]));

    expect(errors).toContain('Requirement rule id "foundation" is duplicated.');
    expect(errors).toContain('Rule "foundation" requires at least one accepted tag.');
    expect(errors).toContain('Rule "foundation" requires at least one focus area.');
    expect(errors).toContain("Cannot tag unknown module UNKNOWN1000.");
    expect(errors).toContain("Module tag change for UNKNOWN1000 is duplicated.");
  });

  it("allows unknown rule modules only when cloning", () => {
    const draftWithRemovedModule: AdminCurriculumDraft = {
      ...validDraft,
      rules: [{
        id: "legacy-foundation",
        label: "Legacy foundation",
        type: "module-list",
        requiredModules: ["CS1101S", "CS9999"]
      }],
      tagChanges: [{ moduleCode: "UNKNOWN1000", tags: ["legacy"] }]
    };

    const errors = validateDraftSemantics(
      draftWithRemovedModule,
      new Set(["CS1101S"]),
      { allowUnknownRuleModules: true }
    );

    expect(errors).not.toContain('Rule "legacy-foundation" references unknown module CS9999.');
    expect(errors).toContain("Cannot tag unknown module UNKNOWN1000.");
  });
});
