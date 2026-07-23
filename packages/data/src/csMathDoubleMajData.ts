import type { Module, ModuleRequirementTags, RequirementSet } from "@the-cs-plan/shared";
import {
  csModuleRequirementTags,
  csRequirementSet,
  generatedCsModuleRequirementTags,
  getCompleteCsModuleRequirementTags
} from "./computerScienceData.js";

const programme = "computer-science-mathematics-double-major" as const;
const cohort = "AY2025/26" as const;

const representativeMathModuleCodes = [
  "MA1521",
  "MA1522",
  "MA2001",
  "MA2002",
  "MA2101",
  "MA2101S",
  "MA2104",
  "MA2311",
  "MA2108",
  "MA2108S",
  "MA2116",
  "MA2116T",
  "MA2216",
  "ST2131",
  "ST2334",
  "ST3236",
  "ST4238",
  "ME3291",
  "ME4291",
  "PC3274A"
];

export const csMathDoubleMajModuleRequirementTags: ModuleRequirementTags[] =
  mergeModuleRequirementTags([
    ...csModuleRequirementTags.map(toCsMathDoubleMajorMapping),
    ...generatedCsModuleRequirementTags.map(toCsMathDoubleMajorMapping),
    ...getGeneratedCsMathDoubleMajModuleRequirementTags(
      representativeMathModuleCodes.map((moduleCode) => ({ moduleCode }))
    )
  ]);

export function getCompleteCsMathDoubleMajModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  const baseMappings = getCompleteCsModuleRequirementTags(modules)
    .filter((mapping) => mapping.cohort === cohort)
    .map(toCsMathDoubleMajorMapping);

  return mergeModuleRequirementTags([
    ...baseMappings,
    ...csMathDoubleMajModuleRequirementTags,
    ...getGeneratedCsMathDoubleMajModuleRequirementTags(modules)
  ]);
}

export const csMathDoubleMajRequirementSet: RequirementSet = {
  programme,
  cohort,
  version: 2,
  totalUnits: 160,
  sourceNote:
    "NUS Computer Science AY2025/26 curriculum with the NUS Mathematics Second Major requirements updated 14 October 2025: https://www.math.nus.edu.sg/wp-content/uploads/sites/4/2026/07/MA2_2122_14102025.pdf",
  rules: csRequirementSet.rules.map((rule) => {
    if (rule.id === "cs-math") {
      return {
        id: "cs-math",
        label: "Mathematics and Sciences",
        type: "capped-units-from-tags" as const,
        requiredUnits: 36,
        acceptedTags: [
          "cs-math-lower-level",
          "cs-math-linear-algebra-2",
          "cs-math-calculus-option",
          "cs-math-analysis-1",
          "cs-math-probability",
          "cs-math-upper-level"
        ],
        tagCaps: [
          { tag: "cs-math-lower-level", maxUnits: 8 },
          { tag: "cs-math-linear-algebra-2", maxUnits: 4 },
          { tag: "cs-math-calculus-option", maxUnits: 4 },
          { tag: "cs-math-analysis-1", maxUnits: 4 },
          { tag: "cs-math-probability", maxUnits: 4 },
          { tag: "cs-math-upper-level", maxUnits: 12 }
        ]
      };
    }
    if (rule.id === "ue") {
      return { ...rule, requiredUnits: 16 };
    }
    return rule;
  })
};

function getGeneratedCsMathDoubleMajModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  return modules.flatMap(({ moduleCode }) => {
    const tags: string[] = [];
    const isExcludedIndependentStudy = /^MA[34](?:288|289)[A-Z]*$/.test(moduleCode);
    const isApprovedMa22 = /^MA22\d{2}[A-Z]*$/.test(moduleCode)
      && !/^MA22(?:88|89)[A-Z]*$/.test(moduleCode);

    if (
      (/^MA(?:15|20)\d{2}[A-Z]*$/.test(moduleCode) || isApprovedMa22)
      && !/^MA(?:2288|2289)[A-Z]*$/.test(moduleCode)
    ) {
      tags.push("cs-math-lower-level");
    }
    if (moduleCode === "MA2101" || moduleCode === "MA2101S") {
      tags.push("cs-math-linear-algebra-2");
    }
    if (moduleCode === "MA2104" || moduleCode === "MA2311" || isApprovedMa22) {
      tags.push("cs-math-calculus-option");
    }
    if (moduleCode === "MA2108" || moduleCode === "MA2108S") {
      tags.push("cs-math-analysis-1");
    }
    if (["MA2116", "MA2116T", "MA2216", "ST2131", "ST2334"].includes(moduleCode)) {
      tags.push("cs-math-probability");
    }
    if (
      (/^MA(?:32|42)\d{2}[A-Z]*$/.test(moduleCode) && !isExcludedIndependentStudy)
      || ["ST3236", "ST4238", "ME3291", "ME4291", "PC3274A"].includes(moduleCode)
    ) {
      tags.push("cs-math-upper-level");
    }

    return tags.length > 0 ? [{ programme, cohort, moduleCode, tags }] : [];
  });
}

function toCsMathDoubleMajorMapping(
  mapping: ModuleRequirementTags
): ModuleRequirementTags {
  return {
    programme,
    cohort,
    moduleCode: mapping.moduleCode,
    tags: mapping.tags.filter((tag) => tag !== "cs-math")
  };
}

function mergeModuleRequirementTags(
  mappings: ModuleRequirementTags[]
): ModuleRequirementTags[] {
  const merged = new Map<string, ModuleRequirementTags>();
  for (const mapping of mappings) {
    const existing = merged.get(mapping.moduleCode);
    const tags = Array.from(new Set([...(existing?.tags ?? []), ...mapping.tags]));
    const hasMathTag = tags.some((tag) => tag.startsWith("cs-math-"));
    const curriculumTags = hasMathTag
      ? tags.filter((tag) => tag !== "ue" && tag !== "cd")
      : tags;
    const nonUeTags = curriculumTags.filter((tag) => tag !== "ue");
    merged.set(mapping.moduleCode, {
      ...mapping,
      tags: nonUeTags.length > 0 ? nonUeTags : curriculumTags
    });
  }
  return Array.from(merged.values()).filter((mapping) => mapping.tags.length > 0);
}
