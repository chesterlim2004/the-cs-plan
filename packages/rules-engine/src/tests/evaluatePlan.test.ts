import { describe, expect, it } from "vitest";
import { csRequirementSet, seededModules } from "@the-cs-plan/data";
import { createSemestersUntil, type Plan } from "@the-cs-plan/shared";
import { evaluatePlan, getPrerequisiteWarnings } from "../index.js";

function makePlan(): Plan {
  return {
    name: "Test Plan",
    programme: "computer-science",
    cohort: "AY2025/26",
    semesters: createSemestersUntil("Y4S2")
  };
}

describe("evaluatePlan", () => {
  it("marks required modules as fulfilled when all are planned", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CS1101S", units: 4, status: "completed" },
      { type: "module", moduleCode: "CS1231S", units: 4, status: "completed" },
      { type: "module", moduleCode: "CS2030S", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2040S", units: 4, status: "planned" },
      { type: "module", moduleCode: "MA1521", units: 4, status: "completed" }
    );

    const result = evaluatePlan(csRequirementSet, plan, seededModules);
    const foundation = result.requirements.find((requirement) => requirement.id === "cs-foundation");

    expect(foundation?.status).toBe("fulfilled");
    expect(foundation?.percentage).toBe(100);
  });

  it("reports missing modules for incomplete module-list rules", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS1101S", units: 4, status: "completed" });

    const result = evaluatePlan(csRequirementSet, plan, seededModules);
    const foundation = result.requirements.find((requirement) => requirement.id === "cs-foundation");

    expect(foundation?.status).toBe("partial");
    expect(foundation?.missing).toContain("CS2030S");
  });

  it("counts placeholders toward matching placeholder rules", () => {
    const plan = makePlan();
    plan.semesters[3]?.items.push({
      type: "placeholder",
      requirementId: "idcd",
      label: "ID/CD placeholder",
      units: 4
    });

    const result = evaluatePlan(csRequirementSet, plan, seededModules);
    const idcd = result.requirements.find((requirement) => requirement.id === "idcd");

    expect(idcd?.status).toBe("fulfilled");
    expect(idcd?.contributors).toEqual(["ID/CD placeholder"]);
  });

  it("warns on unknown modules instead of crashing", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS9999", units: 4, status: "planned" });

    const result = evaluatePlan(csRequirementSet, plan, seededModules);

    expect(result.warnings).toContain("Unknown module CS9999 is included in the plan.");
  });

  it("produces advisory prerequisite warnings", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS2030S", units: 4, status: "planned" });

    expect(getPrerequisiteWarnings(plan, seededModules)[0]).toContain("CS2030S");
  });
});
