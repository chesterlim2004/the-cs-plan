import { describe, expect, it } from "vitest";
import {
  csModuleRequirementTags,
  csRequirementSet,
  fallbackModules,
  getCompleteCsModuleRequirementTags
} from "@the-cs-plan/data";
import {
  createSemestersUntil,
  type Module,
  type ModuleRequirementTags,
  type Plan,
  type RequirementSet
} from "@the-cs-plan/shared";
import { evaluatePlan, getPrerequisiteWarnings } from "../index.js";

function makePlan(): Plan {
  return {
    name: "Test Plan",
    programme: "computer-science",
    cohort: "AY2025/26",
    semesters: createSemestersUntil("Y4S2")
  };
}

function makeTagLookup(mappings: ModuleRequirementTags[]) {
  return new Map(mappings.map((mapping) => [mapping.moduleCode, mapping.tags]));
}

function makeModules(moduleCodes: string[]): Module[] {
  return moduleCodes.map((moduleCode) => ({
    acadYear: "2025-2026",
    moduleCode,
    title: moduleCode,
    units: moduleCode === "CP3200" ? 6 : 4
  }));
}

function makeBreadthDepthTags(moduleCodes: string[]) {
  const industryCodes = new Set(["CP3880", "IS4010", "ETP3201L", "CP3200", "CP3202", "CP3107", "CP3110", "ETP3205"]);
  return new Map(
    moduleCodes.map((moduleCode) => {
      const tags = ["cs-breadth-and-depth"];
      if (industryCodes.has(moduleCode)) {
        tags.push("cs-bd-industry");
      }
      if (moduleCode === "CP4101") {
        tags.push("cs-bd-dissertation");
      }
      return [moduleCode, tags] as const;
    })
  );
}

function makeDdpPathwayRequirementSet(): RequirementSet {
  return {
    programme: "business-analytics-economics-double-degree",
    cohort: "AY2025/26",
    version: 1,
    totalUnits: 28,
    sourceNote: "Test",
    rules: [{
      id: "honours-pathway",
      label: "Honours Pathway",
      type: "structured-ddp-honours-pathway",
      requiredUnits: 28,
      integratedThesisTags: ["ddp-integrated-thesis"],
      economicsElectiveTags: ["ddp-economics-elective"],
      economicsLevel4000Tags: ["ddp-economics-level4000"],
      industryTags: ["ddp-ier-full"],
      internshipFoundationTags: ["ddp-ier-foundation"],
      secondInternshipTags: ["ddp-ier-second"],
      supplementaryTags: ["ddp-ier-supplementary"],
      integratedThesisUnits: 12,
      integratedEconomicsUnits: 16,
      integratedEconomicsLevel4000Units: 8,
      requiredFoundationUnits: 6,
      requiredCompanionUnits: 6,
      internshipEconomicsUnits: 28,
      internshipEconomicsLevel4000Units: 20,
      internshipPathwayRequiredUnits: 40,
      advisory: "Use the integrated thesis route for Highest Distinction."
    }]
  };
}

describe("evaluatePlan", () => {
  it("optimally assigns modules that can satisfy multiple capped tag categories", () => {
    const moduleCodes = ["MA2216", "MA1521", "MA1522", "ST2334"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );
    const requirementSet: RequirementSet = {
      programme: "computer-science-mathematics-double-major",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 16,
      sourceNote: "Test",
      rules: [{
        id: "cs-math",
        label: "Mathematics and Sciences",
        type: "capped-units-from-tags",
        requiredUnits: 16,
        acceptedTags: ["lower", "calculus", "probability"],
        tagCaps: [
          { tag: "lower", maxUnits: 8 },
          { tag: "calculus", maxUnits: 4 },
          { tag: "probability", maxUnits: 4 }
        ]
      }]
    };
    const tags = new Map([
      ["MA2216", ["lower", "calculus", "probability"]],
      ["MA1521", ["lower"]],
      ["MA1522", ["lower"]],
      ["ST2334", ["probability"]]
    ]);

    const result = evaluatePlan(requirementSet, plan, makeModules(moduleCodes), tags);

    expect(result.requirements[0]).toMatchObject({
      status: "fulfilled",
      completedUnits: 16,
      contributors: moduleCodes
    });
  });

  it("evaluates the DDP integrated thesis route as a 28-unit pathway", () => {
    const moduleCodes = ["XFC4101", "EC4101", "EC4102", "EC3103", "EC3104"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: moduleCode === "XFC4101" ? 12 : 4,
        status: "planned" as const
      }))
    );
    const requirementSet = makeDdpPathwayRequirementSet();
    const tags = new Map(moduleCodes.map((moduleCode) => [
      moduleCode,
      moduleCode === "XFC4101"
        ? ["ddp-integrated-thesis"]
        : [
            "ddp-economics-elective",
            ...(moduleCode.startsWith("EC4") ? ["ddp-economics-level4000"] : [])
          ]
    ] as const));

    const result = evaluatePlan(
      requirementSet,
      plan,
      moduleCodes.map((moduleCode) => ({
        acadYear: "2026-2027",
        moduleCode,
        title: moduleCode,
        units: moduleCode === "XFC4101" ? 12 : 4
      })),
      tags
    );

    expect(result.totalRequiredUnits).toBe(28);
    expect(result.requirements[0]).toMatchObject({
      status: "fulfilled",
      completedUnits: 28,
      requiredUnits: 28
    });
  });

  it("evaluates the DDP internship route as a 40-unit pathway", () => {
    const economicsCodes = [
      "EC4101",
      "EC4102",
      "EC4103",
      "EC4104",
      "EC4105",
      "EC3103",
      "EC3104"
    ];
    const moduleCodes = ["IS4010", ...economicsCodes];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: moduleCode === "IS4010" ? 12 : 4,
        status: "planned" as const
      }))
    );
    const requirementSet = makeDdpPathwayRequirementSet();
    const tags = new Map(moduleCodes.map((moduleCode) => [
      moduleCode,
      moduleCode === "IS4010"
        ? ["ddp-ier-full"]
        : [
            "ddp-economics-elective",
            ...(moduleCode.startsWith("EC4") ? ["ddp-economics-level4000"] : [])
          ]
    ] as const));

    const result = evaluatePlan(
      requirementSet,
      plan,
      moduleCodes.map((moduleCode) => ({
        acadYear: "2026-2027",
        moduleCode,
        title: moduleCode,
        units: moduleCode === "IS4010" ? 12 : 4
      })),
      tags
    );

    expect(result.totalRequiredUnits).toBe(40);
    expect(result.requirements[0]).toMatchObject({
      status: "fulfilled",
      completedUnits: 40,
      requiredUnits: 40,
      warnings: ["Use the integrated thesis route for Highest Distinction."]
    });
  });

  it("marks required modules as fulfilled when all are planned", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CS1231S", units: 4, status: "completed" },
      { type: "module", moduleCode: "CS2030S", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2040S", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2100", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2101", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2103T", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2106", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2109S", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS3230", units: 4, status: "planned" }
    );

    const result = evaluatePlan(csRequirementSet, plan, fallbackModules, makeTagLookup(csModuleRequirementTags));
    const foundation = result.requirements.find((requirement) => requirement.id === "cs-foundation");

    expect(foundation?.status).toBe("fulfilled");
    expect(foundation?.percentage).toBe(100);
  });

  it("reports missing units for incomplete tag rules", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS1231S", units: 4, status: "completed" });

    const result = evaluatePlan(csRequirementSet, plan, fallbackModules, makeTagLookup(csModuleRequirementTags));
    const foundation = result.requirements.find((requirement) => requirement.id === "cs-foundation");

    expect(foundation?.status).toBe("partial");
    expect(foundation?.missing).toContain("32 units remaining");
  });

  it("caps repeated university pillar modules at one module per pillar", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CS1101S", units: 4, status: "completed" },
      { type: "module", moduleCode: "GEA1000", units: 4, status: "completed" },
      { type: "module", moduleCode: "BT1101", units: 4, status: "completed" }
    );

    const result = evaluatePlan(csRequirementSet, plan, fallbackModules, makeTagLookup(csModuleRequirementTags));
    const universityPillars = result.requirements.find((requirement) => requirement.id === "university-pillars");

    expect(universityPillars?.completedUnits).toBe(8);
    expect(universityPillars?.contributors).toEqual(["CS1101S", "GEA1000"]);
  });

  it("counts ID and CD placeholders toward the idcd progress bar and constraints", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      {
        type: "placeholder",
        requirementId: "id",
        label: "ID placeholder 1",
        units: 4
      },
      {
        type: "placeholder",
        requirementId: "id",
        label: "ID placeholder 2",
        units: 4
      },
      {
        type: "placeholder",
        requirementId: "cd",
        label: "CD placeholder",
        units: 4
      }
    );

    const result = evaluatePlan(csRequirementSet, plan, fallbackModules, makeTagLookup(csModuleRequirementTags));
    const idcd = result.requirements.find((requirement) => requirement.id === "idcd");

    expect(idcd?.completedUnits).toBe(12);
    expect(idcd?.status).toBe("fulfilled");
    expect(idcd?.contributors).toEqual(["ID placeholder 1", "ID placeholder 2", "CD placeholder"]);
  });

  it("counts CS Foundation placeholders toward the foundation progress bar", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({
      type: "placeholder",
      requirementId: "cs-foundation",
      label: "CS Foundation placeholder",
      units: 4
    });

    const result = evaluatePlan(csRequirementSet, plan, fallbackModules, makeTagLookup(csModuleRequirementTags));
    const foundation = result.requirements.find((requirement) => requirement.id === "cs-foundation");

    expect(foundation?.completedUnits).toBe(4);
    expect(foundation?.contributors).toEqual(["CS Foundation placeholder"]);
  });

  it("normalizes ID tag casing", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS9998", units: 4, status: "planned" });
    const modules: Module[] = [
      {
        acadYear: "2025-2026",
        moduleCode: "CS9998",
        title: "Tagged Module",
        units: 4
      }
    ];

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      modules,
      new Map([["CS9998", ["ID"]]])
    );
    const idcd = result.requirements.find((requirement) => requirement.id === "idcd");

    expect(idcd?.completedUnits).toBe(4);
    expect(idcd?.contributors).toEqual(["CS9998"]);
  });

  it("fulfills ID/CD with at least two ID courses and at most one CD course", () => {
    const moduleCodes = ["EG2501", "DTK1234", "ACC1701"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      new Map([
        ["EG2501", ["id"]],
        ["DTK1234", ["id"]],
        ["ACC1701", ["cd"]]
      ])
    );
    const idcd = result.requirements.find((requirement) => requirement.id === "idcd");

    expect(idcd?.completedUnits).toBe(12);
    expect(idcd?.status).toBe("fulfilled");
    expect(idcd?.missing).toEqual([]);
  });

  it("keeps ID/CD partial when 12 units are reached with fewer than two ID courses", () => {
    const moduleCodes = ["EG2501", "ACC1701", "DAO2703"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      new Map([
        ["EG2501", ["id"]],
        ["ACC1701", ["cd"]],
        ["DAO2703", ["cd"]]
      ])
    );
    const idcd = result.requirements.find((requirement) => requirement.id === "idcd");

    expect(idcd?.completedUnits).toBe(12);
    expect(idcd?.status).toBe("partial");
    expect(idcd?.missing).toContain("1 more ID course required");
    expect(idcd?.missing).toContain("At most 1 CD course may count");
  });

  it("keeps one singapore studies module in university pillars instead of UE", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "GES1000", units: 4, status: "planned" });

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(["GES1000"]),
      new Map([["GES1000", ["singapore-studies"]]])
    );

    expect(result.requirements.find((requirement) => requirement.id === "university-pillars")?.contributors).toEqual(["GES1000"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.completedUnits).toBe(0);
  });

  it("moves the later duplicate singapore studies module into UE", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "GES1000", units: 4, status: "planned" });
    plan.semesters[1]?.items.push({ type: "module", moduleCode: "GES1001", units: 4, status: "planned" });

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(["GES1000", "GES1001"]),
      new Map([
        ["GES1000", ["singapore-studies"]],
        ["GES1001", ["singapore-studies"]]
      ])
    );

    expect(result.requirements.find((requirement) => requirement.id === "university-pillars")?.contributors).toEqual(["GES1000"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.contributors).toEqual(["GES1001"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.completedUnits).toBe(4);
  });

  it("lets the remaining singapore studies module satisfy the pillar when the earlier one is removed", () => {
    const plan = makePlan();
    plan.semesters[1]?.items.push({ type: "module", moduleCode: "GES1001", units: 4, status: "planned" });

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(["GES1001"]),
      new Map([["GES1001", ["singapore-studies"]]])
    );

    expect(result.requirements.find((requirement) => requirement.id === "university-pillars")?.contributors).toEqual(["GES1001"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.completedUnits).toBe(0);
  });

  it("moves extra CS Math modules beyond 12 units into UE", () => {
    const moduleCodes = ["MA1521", "MA1522", "ST2334", "MA9999"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      new Map(moduleCodes.map((moduleCode) => [moduleCode, ["cs-math"]] as const))
    );

    expect(result.requirements.find((requirement) => requirement.id === "cs-math")?.contributors).toEqual(["MA1521", "MA1522", "ST2334"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.contributors).toEqual(["MA9999"]);
  });

  it("moves extra ID/CD modules into UE but ignores extra non-UE placeholders", () => {
    const moduleCodes = ["EG2501", "DTK1234", "IE2141", "PF1101"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.slice(0, 3).map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      })),
      {
        type: "placeholder",
        requirementId: "cd",
        label: "CD placeholder",
        units: 4
      },
      { type: "module", moduleCode: "PF1101", units: 4, status: "planned" }
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      new Map(moduleCodes.map((moduleCode) => [moduleCode, ["id"]] as const))
    );

    expect(result.requirements.find((requirement) => requirement.id === "idcd")?.contributors).toEqual(["EG2501", "DTK1234", "IE2141"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.contributors).toEqual(["PF1101"]);
  });

  it("counts UE placeholders directly under UE", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({
      type: "placeholder",
      requirementId: "ue",
      label: "UE placeholder",
      units: 4
    });

    const result = evaluatePlan(csRequirementSet, plan, fallbackModules, makeTagLookup(csModuleRequirementTags));

    expect(result.requirements.find((requirement) => requirement.id === "ue")?.completedUnits).toBe(4);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.contributors).toEqual(["UE placeholder"]);
  });

  it("does not count a consumed non-UE module again as UE", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS1231S", units: 4, status: "planned" });

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(["CS1231S"]),
      new Map([["CS1231S", ["cs-foundation", "ue"]]])
    );

    expect(result.requirements.find((requirement) => requirement.id === "cs-foundation")?.contributors).toEqual(["CS1231S"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.completedUnits).toBe(0);
  });

  it("keeps breadth and depth partial at 32 units without a completed focus area", () => {
    const moduleCodes = ["CS3230", "CS3243", "CS3241", "CS2107", "CS2102", "CS3245", "CS2105", "CP3200"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: moduleCode === "CP3200" ? 6 : 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      makeBreadthDepthTags(moduleCodes)
    );
    const breadthDepth = result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth");

    expect(breadthDepth?.completedUnits).toBe(32);
    expect(breadthDepth?.status).toBe("partial");
    expect(breadthDepth?.missing).toContain("Complete one CS focus area with 3 modules, including at least one Level-4000 module");
  });

  it("fulfills breadth and depth when units and all sub-constraints pass", () => {
    const moduleCodes = ["CS3230", "CS3231", "CS3236", "CS4231", "CS4234", "CS4243", "CS4244", "CP3200"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: moduleCode === "CP3200" ? 6 : 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      makeBreadthDepthTags(moduleCodes)
    );
    const breadthDepth = result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth");

    expect(breadthDepth?.completedUnits).toBe(32);
    expect(breadthDepth?.status).toBe("fulfilled");
    expect(breadthDepth?.missing).toEqual([]);
  });

  it("moves extra breadth and depth modules beyond 32 units into UE", () => {
    const moduleCodes = ["CS3230", "CS3231", "CS3236", "CS4231", "CS4234", "CS4243", "CS4244", "CP4101", "CS4248"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      makeBreadthDepthTags(moduleCodes)
    );

    expect(result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth")?.completedUnits).toBe(32);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.contributors).toEqual(["CS4248"]);
  });

  it("requires a Level-4000 module for breadth and depth focus area completion", () => {
    const moduleCodes = ["CS3230", "CS3231", "CS3236", "CS3243", "CS3244", "CS3241", "CS3242", "CP3200"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: moduleCode === "CP3200" ? 6 : 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      makeBreadthDepthTags(moduleCodes)
    );
    const breadthDepth = result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth");

    expect(breadthDepth?.status).toBe("partial");
    expect(breadthDepth?.missing).toContain("Complete one CS focus area with 3 modules, including at least one Level-4000 module");
  });

  it("allows CP4101 as the breadth and depth dissertation replacement for industry experience", () => {
    const moduleCodes = ["CS3230", "CS3231", "CS3236", "CS4231", "CS4234", "CS4243", "CS4244", "CP4101"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      makeBreadthDepthTags(moduleCodes)
    );
    const breadthDepth = result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth");

    expect(breadthDepth?.missing).not.toContain("6 Industry Experience units remaining");
  });

  it("flags excess industry experience", () => {
    const moduleCodes = ["CP3200", "CP3202", "CP3107", "CS3230", "CS3231", "CS3236", "CS4231", "CS4234"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: moduleCode === "CP3200" ? 6 : 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      makeBreadthDepthTags(moduleCodes)
    );
    const breadthDepth = result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth");

    expect(breadthDepth?.missing).toContain("Industry Experience exceeds maximum by 2 units");
  });

  it("flags excess non-industry CP units within the 32-unit breadth and depth allocation", () => {
    const moduleCodes = ["CP9991", "CP9992", "CP9993", "CP9994", "CS3230", "CS3231", "CS3236", "CS4231"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );
    const tags = makeBreadthDepthTags(moduleCodes);
    tags.set("CP9991", ["cs-breadth-and-depth"]);
    tags.set("CP9992", ["cs-breadth-and-depth"]);
    tags.set("CP9993", ["cs-breadth-and-depth"]);
    tags.set("CP9994", ["cs-breadth-and-depth"]);

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      tags
    );
    const breadthDepth = result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth");

    expect(breadthDepth?.missing).toContain("Non-industry CP-coded modules exceed maximum by 4 units");
  });

  it("flags non-industry breadth and depth modules with disallowed prefixes", () => {
    const moduleCodes = ["CS3230", "CS3231", "CS3236", "CS4231", "CS4234", "CS4243", "BT9999", "CP3200"];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      ...moduleCodes.map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: moduleCode === "CP3200" ? 6 : 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(moduleCodes),
      makeBreadthDepthTags(moduleCodes)
    );
    const breadthDepth = result.requirements.find((requirement) => requirement.id === "cs-breadth-and-depth");

    expect(breadthDepth?.missing).toContain("Non-industry B&D modules must be CS/IFS/CP-coded: BT9999");
  });

  it("uses actual module units for fixed module-list requirements", () => {
    const requirementSet: RequirementSet = {
      programme: "business-analytics",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 12,
      sourceNote: "Test",
      rules: [{
        id: "core",
        label: "Core",
        type: "module-list",
        requiredUnits: 12,
        requiredModules: ["BT2101", "BT4103"]
      }]
    };
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "BT2101", units: 4, status: "planned" },
      { type: "module", moduleCode: "BT4103", units: 8, status: "planned" }
    );

    const result = evaluatePlan(
      requirementSet,
      plan,
      [
        { acadYear: "2026-2027", moduleCode: "BT2101", title: "BT2101", units: 4 },
        { acadYear: "2026-2027", moduleCode: "BT4103", title: "BT4103", units: 8 }
      ]
    );

    expect(result.requirements[0]?.completedUnits).toBe(12);
    expect(result.requirements[0]?.status).toBe("fulfilled");
  });

  it("requires a complete statistics alternative and sends excess pair units to UE", () => {
    const requirementSet: RequirementSet = {
      programme: "business-analytics",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 44,
      sourceNote: "Test",
      rules: [
        {
          id: "statistics",
          label: "Probability and Statistics",
          type: "module-choice",
          requiredUnits: 4,
          moduleOptions: [
            ["ST2334"],
            ["ST2131", "ST2132"],
            ["MA2116", "ST2132"],
            ["MA2116T", "ST2132"]
          ]
        },
        {
          id: "ue",
          label: "Unrestricted Electives",
          type: "residual-units",
          requiredUnits: 40,
          acceptedTags: ["ue"]
        }
      ]
    };
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "MA2116", units: 4, status: "planned" },
      { type: "module", moduleCode: "ST2132", units: 4, status: "planned" }
    );

    const result = evaluatePlan(
      requirementSet,
      plan,
      makeModules(["MA2116", "ST2132"]),
      new Map()
    );

    expect(result.requirements.find((requirement) => requirement.id === "statistics")?.status).toBe("fulfilled");
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.completedUnits).toBe(4);
  });

  it("fulfills programme electives when total, level, and prefix constraints overlap", () => {
    const moduleCodes = ["BT3017", "BT3102", "BT4012", "IS4241", "CS4248"];
    const requirementSet: RequirementSet = {
      programme: "business-analytics",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 20,
      sourceNote: "Test",
      rules: [{
        id: "programme-electives",
        label: "Programme Electives",
        type: "structured-programme-electives",
        requiredUnits: 20,
        acceptedTags: ["ba-programme-elective"],
        requiredMinCourses: 5,
        requiredLevel4000MinCourses: 3,
        requiredPrefixMinCourses: 3,
        requiredPrefixes: ["BT"]
      }]
    };
    const plan = makePlan();
    plan.semesters[0]?.items.push(...moduleCodes.map((moduleCode) => ({
      type: "module" as const,
      moduleCode,
      units: 4,
      status: "planned" as const
    })));

    const result = evaluatePlan(
      requirementSet,
      plan,
      makeModules(moduleCodes),
      new Map(moduleCodes.map((moduleCode) => [moduleCode, ["ba-programme-elective"]]))
    );

    expect(result.requirements[0]?.status).toBe("fulfilled");
    expect(result.requirements[0]?.completedUnits).toBe(20);
    expect(result.requirements[0]?.missing).toEqual([]);
  });

  it("keeps programme electives partial when the BT-coded minimum is not met", () => {
    const moduleCodes = ["BT4012", "BT3017", "IS4241", "CS4248", "ST4245"];
    const requirementSet: RequirementSet = {
      programme: "business-analytics",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 20,
      sourceNote: "Test",
      rules: [{
        id: "programme-electives",
        label: "Programme Electives",
        type: "structured-programme-electives",
        requiredUnits: 20,
        acceptedTags: ["ba-programme-elective"],
        requiredMinCourses: 5,
        requiredLevel4000MinCourses: 3,
        requiredPrefixMinCourses: 3,
        requiredPrefixes: ["BT"]
      }]
    };
    const plan = makePlan();
    plan.semesters[0]?.items.push(...moduleCodes.map((moduleCode) => ({
      type: "module" as const,
      moduleCode,
      units: 4,
      status: "planned" as const
    })));

    const result = evaluatePlan(
      requirementSet,
      plan,
      makeModules(moduleCodes),
      new Map(moduleCodes.map((moduleCode) => [moduleCode, ["ba-programme-elective"]]))
    );

    expect(result.requirements[0]?.status).toBe("partial");
    expect(result.requirements[0]?.missing).toContain("1 more BT-coded programme elective course required");
  });

  it("fulfills industry experience with two three-month internships", () => {
    const requirementSet = makeIndustryExperienceRequirementSet();
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CP3200", units: 6, status: "planned" },
      { type: "module", moduleCode: "CP3202", units: 6, status: "planned" }
    );

    const result = evaluatePlan(
      requirementSet,
      plan,
      [
        { acadYear: "2026-2027", moduleCode: "CP3200", title: "CP3200", units: 6 },
        { acadYear: "2026-2027", moduleCode: "CP3202", title: "CP3202", units: 6 }
      ],
      new Map([
        ["CP3200", ["ba-ier-foundation"]],
        ["CP3202", ["ba-ier-second-internship"]]
      ])
    );

    expect(result.requirements[0]?.status).toBe("fulfilled");
    expect(result.requirements[0]?.contributors).toEqual(["CP3200", "CP3202"]);
  });

  it("fulfills industry experience with CP3200 and supplementary courses", () => {
    const requirementSet = makeIndustryExperienceRequirementSet();
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CP3200", units: 6, status: "planned" },
      { type: "module", moduleCode: "CP3201", units: 2, status: "planned" },
      { type: "module", moduleCode: "BT4301", units: 4, status: "planned" }
    );
    const moduleCodes = ["CP3200", "CP3201", "BT4301"];

    const result = evaluatePlan(
      requirementSet,
      plan,
      [
        { acadYear: "2026-2027", moduleCode: "CP3200", title: "CP3200", units: 6 },
        { acadYear: "2026-2027", moduleCode: "CP3201", title: "CP3201", units: 2 },
        { acadYear: "2026-2027", moduleCode: "BT4301", title: "BT4301", units: 4 }
      ],
      new Map(moduleCodes.map((moduleCode) => [
        moduleCode,
        moduleCode === "CP3200" ? ["ba-ier-foundation"] : ["ba-ier-supplementary"]
      ]))
    );

    expect(result.requirements[0]?.status).toBe("fulfilled");
    expect(result.requirements[0]?.completedUnits).toBe(12);
  });

  it("routes unused NOC dissertation units into unrestricted electives", () => {
    const requirementSet: RequirementSet = {
      ...makeIndustryExperienceRequirementSet(),
      totalUnits: 52,
      rules: [
        ...makeIndustryExperienceRequirementSet().rules,
        {
          id: "ue",
          label: "Unrestricted Electives",
          type: "residual-units",
          requiredUnits: 40,
          acceptedTags: ["ue"]
        }
      ]
    };
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "ETP3202L", units: 8, status: "planned" },
      { type: "module", moduleCode: "ETP3203L", units: 8, status: "planned" }
    );

    const result = evaluatePlan(
      requirementSet,
      plan,
      [
        { acadYear: "2026-2027", moduleCode: "ETP3202L", title: "ETP3202L", units: 8 },
        { acadYear: "2026-2027", moduleCode: "ETP3203L", title: "ETP3203L", units: 8 }
      ],
      new Map([
        ["ETP3202L", ["ba-ier-dissertation-8"]],
        ["ETP3203L", ["ba-ier-dissertation-4"]]
      ])
    );

    expect(result.requirements.find((requirement) => requirement.id === "industry-experience")?.status).toBe("fulfilled");
    expect(result.requirements.find((requirement) => requirement.id === "industry-experience")?.warnings).toHaveLength(1);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.completedUnits).toBe(4);
  });

  it("applies the unused ETP3203L units to programme electives when eligible", () => {
    const requirementSet: RequirementSet = {
      ...makeIndustryExperienceRequirementSet(),
      totalUnits: 32,
      rules: [
        ...makeIndustryExperienceRequirementSet().rules,
        {
          id: "programme-electives",
          label: "Programme Electives",
          type: "structured-programme-electives",
          requiredUnits: 20,
          acceptedTags: ["ba-programme-elective"],
          requiredMinCourses: 5,
          requiredLevel4000MinCourses: 3,
          requiredPrefixMinCourses: 3,
          requiredPrefixes: ["BT"]
        }
      ]
    };
    const moduleCodes = [
      "ETP3202L",
      "ETP3203L",
      "BT4012",
      "BT4013",
      "BT4014",
      "IS4241"
    ];
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "ETP3202L", units: 8, status: "planned" },
      { type: "module", moduleCode: "ETP3203L", units: 8, status: "planned" },
      ...moduleCodes.slice(2).map((moduleCode) => ({
        type: "module" as const,
        moduleCode,
        units: 4,
        status: "planned" as const
      }))
    );

    const result = evaluatePlan(
      requirementSet,
      plan,
      moduleCodes.map((moduleCode) => ({
        acadYear: "2026-2027",
        moduleCode,
        title: moduleCode,
        units: moduleCode.startsWith("ETP") ? 8 : 4
      })),
      new Map(moduleCodes.map((moduleCode) => {
        if (moduleCode === "ETP3202L") {
          return [moduleCode, ["ba-ier-dissertation-8"]];
        }
        if (moduleCode === "ETP3203L") {
          return [moduleCode, ["ba-ier-dissertation-4", "ba-programme-elective"]];
        }
        return [moduleCode, ["ba-programme-elective"]];
      }))
    );

    expect(result.requirements.find((requirement) => requirement.id === "industry-experience"))
      .toMatchObject({ status: "fulfilled", completedUnits: 12 });
    expect(result.requirements.find((requirement) => requirement.id === "programme-electives"))
      .toMatchObject({ status: "fulfilled", completedUnits: 20 });
  });

  it("warns on unknown modules instead of crashing", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS9999", units: 4, status: "planned" });

    const result = evaluatePlan(csRequirementSet, plan, fallbackModules, makeTagLookup(csModuleRequirementTags));

    expect(result.warnings).toContain("Unknown module CS9999 is included in the plan.");
  });

  it("produces advisory prerequisite warnings", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS2030S", units: 4, status: "planned" });

    expect(getPrerequisiteWarnings(plan, fallbackModules)[0]).toContain("CS2030S");
  });

  it("does not warn when prerequisites are in previous semesters", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS1101S", units: 4, status: "planned" });
    plan.semesters[1]?.items.push({ type: "module", moduleCode: "CS2030S", units: 4, status: "planned" });

    expect(getPrerequisiteWarnings(plan, fallbackModules)).toEqual([]);
  });

  it("warns when a prerequisite is taken in the same semester after the dependent module", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CS2030S", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS1101S", units: 4, status: "planned" }
    );

    expect(getPrerequisiteWarnings(plan, fallbackModules)[0]).toContain("CS2030S");
  });

  it("warns when a prerequisite is taken earlier in the same semester", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CS1101S", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2030S", units: 4, status: "planned" }
    );

    expect(getPrerequisiteWarnings(plan, fallbackModules)[0]).toContain("CS2030S");
  });

  it("uses prereqTree and requires every child in an and tree", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS1101S", units: 4, status: "completed" });
    plan.semesters[1]?.items.push({ type: "module", moduleCode: "CS2100", units: 4, status: "planned" });
    const modules: Module[] = [
      {
        acadYear: "2025-2026",
        moduleCode: "CS1101S",
        title: "Programming Methodology",
        units: 4
      },
      {
        acadYear: "2025-2026",
        moduleCode: "CS2100",
        title: "Computer Organisation",
        units: 4,
        prerequisite: "CS1101S and CS1231S",
        prereqTree: { and: ["CS1101S", "CS1231S"] }
      }
    ];

    expect(getPrerequisiteWarnings(plan, modules)[0]).toContain("CS2100");
  });

  it("uses prereqTree and accepts any satisfied child in an or tree", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "MA1521", units: 4, status: "completed" });
    plan.semesters[1]?.items.push({ type: "module", moduleCode: "CS2100", units: 4, status: "planned" });
    const modules: Module[] = [
      {
        acadYear: "2025-2026",
        moduleCode: "MA1521",
        title: "Calculus for Computing",
        units: 4
      },
      {
        acadYear: "2025-2026",
        moduleCode: "CS2100",
        title: "Computer Organisation",
        units: 4,
        prerequisite: "CS1231S or MA1521",
        prereqTree: { or: ["CS1231S", "MA1521"] }
      }
    ];

    expect(getPrerequisiteWarnings(plan, modules)).toEqual([]);
  });

  it("evaluates prereqTree string nodes that contain module codes and extra text", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS2100", units: 4, status: "planned" });
    const modules: Module[] = [
      {
        acadYear: "2025-2026",
        moduleCode: "CS2100",
        title: "Computer Organisation",
        units: 4,
        prerequisite: "CS1231S or MA1521",
        prereqTree: "CS1231S or MA1521"
      }
    ];

    expect(getPrerequisiteWarnings(plan, modules)[0]).toContain("CS2100");
  });

  it("supports nOf prereqTree nodes", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS1101S", units: 4, status: "completed" });
    plan.semesters[1]?.items.push({ type: "module", moduleCode: "CS2100", units: 4, status: "planned" });
    const modules: Module[] = [
      {
        acadYear: "2025-2026",
        moduleCode: "CS1101S",
        title: "Programming Methodology",
        units: 4
      },
      {
        acadYear: "2025-2026",
        moduleCode: "CS2100",
        title: "Computer Organisation",
        units: 4,
        prerequisite: "One of CS1101S or CS1010S",
        prereqTree: { nOf: [1, ["CS1101S", "CS1010S"]] }
      }
    ];

    expect(getPrerequisiteWarnings(plan, modules)).toEqual([]);
  });

  it("counts only previous-semester modules for nOf prereqTree nodes", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push(
      { type: "module", moduleCode: "CS1101S", units: 4, status: "planned" },
      { type: "module", moduleCode: "CS2100", units: 4, status: "planned" }
    );
    const modules: Module[] = [
      {
        acadYear: "2025-2026",
        moduleCode: "CS1101S",
        title: "Programming Methodology",
        units: 4
      },
      {
        acadYear: "2025-2026",
        moduleCode: "CS2100",
        title: "Computer Organisation",
        units: 4,
        prerequisite: "One of CS1101S or CS1010S",
        prereqTree: { nOf: [1, ["CS1101S", "CS1010S"]] }
      }
    ];

    expect(getPrerequisiteWarnings(plan, modules)[0]).toContain("CS2100");
  });

  it("uses programme-specific tags instead of global module tags", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS2100", units: 4, status: "planned" });

    const taggedResult = evaluatePlan(
      csRequirementSet,
      plan,
      fallbackModules,
      makeTagLookup(csModuleRequirementTags)
    );
    const untaggedResult = evaluatePlan(csRequirementSet, plan, fallbackModules, new Map());

    expect(
      taggedResult.requirements.find((requirement) => requirement.id === "cs-foundation")?.contributors
    ).toContain("CS2100");
    expect(
      untaggedResult.requirements.find((requirement) => requirement.id === "cs-foundation")?.contributors
    ).not.toContain("CS2100");
  });

  it("generates UE tags for modules without CS requirement mappings", () => {
    const plan = makePlan();
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "NM1101E", units: 4, status: "planned" });
    const mappings = getCompleteCsModuleRequirementTags([{ moduleCode: "NM1101E" }]);

    const result = evaluatePlan(
      csRequirementSet,
      plan,
      makeModules(["NM1101E"]),
      makeTagLookup(mappings)
    );

    expect(mappings.find((mapping) => mapping.moduleCode === "NM1101E")?.tags).toEqual(["ue"]);
    expect(result.requirements.find((requirement) => requirement.id === "ue")?.contributors).toEqual(["NM1101E"]);
  });

  it("generates CD tags for PC, CM, LSM, and ZB modules", () => {
    const mappings = getCompleteCsModuleRequirementTags([
      { moduleCode: "PC1101" },
      { moduleCode: "CM1102" },
      { moduleCode: "LSM1101" },
      { moduleCode: "ZB4171" }
    ]);

    expect(mappings.find((mapping) => mapping.moduleCode === "PC1101")?.tags).toEqual(["cd"]);
    expect(mappings.find((mapping) => mapping.moduleCode === "CM1102")?.tags).toEqual(["cd"]);
    expect(mappings.find((mapping) => mapping.moduleCode === "LSM1101")?.tags).toEqual(["cd"]);
    expect(mappings.find((mapping) => mapping.moduleCode === "ZB4171")?.tags).toEqual(["cd"]);
  });

  it("allows different degrees to classify the same module differently", () => {
    const requirementSet: RequirementSet = {
      programme: "business-analytics",
      cohort: "AY2025/26",
      version: 1,
      totalUnits: 160,
      sourceNote: "Test requirement set",
      rules: [
        {
          id: "analytics-core",
          label: "Analytics Core",
          type: "units-from-tags",
          requiredUnits: 4,
          acceptedTags: ["analytics-core"]
        }
      ]
    };
    const plan: Plan = {
      ...makePlan(),
      programme: "business-analytics"
    };
    plan.semesters[0]?.items.push({ type: "module", moduleCode: "CS2100", units: 4, status: "planned" });

    const result = evaluatePlan(
      requirementSet,
      plan,
      fallbackModules,
      new Map([["CS2100", []]])
    );

    expect(result.requirements[0]?.status).toBe("missing");
  });
});

function makeIndustryExperienceRequirementSet(): RequirementSet {
  return {
    programme: "business-analytics",
    cohort: "AY2025/26",
    version: 1,
    totalUnits: 12,
    sourceNote: "Test",
    rules: [{
      id: "industry-experience",
      label: "Industry Experience Requirement",
      type: "structured-industry-experience",
      requiredUnits: 12,
      industryTags: ["ba-ier-full"],
      internshipFoundationTags: ["ba-ier-foundation"],
      secondInternshipTags: ["ba-ier-second-internship"],
      supplementaryTags: ["ba-ier-supplementary"],
      requiredFoundationUnits: 6,
      requiredCompanionUnits: 6,
      dissertationTags: ["ba-ier-dissertation", "ba-ier-dissertation-8", "ba-ier-dissertation-4"],
      tagUnitOverrides: [
        { tag: "ba-ier-dissertation-8", units: 8 },
        { tag: "ba-ier-dissertation-4", units: 4 }
      ],
      advisory: "Dissertation replacement is subject to GPA and completed-unit eligibility."
    }]
  };
}
