import type { Module, ModuleRequirementTags, RequirementSet } from "@the-cs-plan/shared";
import {
  businessAnalyticsModuleRequirementTags,
  businessAnalyticsRequirementSet,
  getCompleteBusinessAnalyticsModuleRequirementTags
} from "./businessAnalyticsData.js";

const programme = "business-analytics-economics-double-major" as const;
const cohort = "AY2025/26" as const;

const economicsCoreModuleCodes = [
  "EC1101E",
  "EC2101",
  "EC2102",
  "EC2104",
  "EC2303",
  "EC3101",
  "EC3102",
  "EC3303"
];

const economicsRecognizedModuleCodes = [
  "ACC1701X",
  "ACC1701XA",
  "ACC1701XB",
  "ACC1701XC",
  "ACC1701XD",
  "ACC1701XE",
  "ACC1710XA",
  "ACC1710XB",
  "ACC1710XC",
  "ACC1710XD",
  "ACC1710XE",
  "BSE3701",
  "BSP1703",
  "BSP1703X",
  "BSS4003A",
  "BSN4811",
  "BSN4811A",
  "BT1101",
  "MA1101R",
  "MA2001",
  "MA1102R",
  "MA2002",
  "MA1505",
  "MA1506",
  "MA1507",
  "MA1508",
  "MA1508E",
  "MA1511",
  "MA1512",
  "MA1513",
  "MA1521",
  "MA2108",
  "MA3110",
  "ST1131",
  "ST2131",
  "MA2216",
  "MA2116",
  "ST3131",
  "PE4101E",
  "PE4102E",
  "PP5141",
  "RE1704",
  "RE2705"
];

export const bzaEconsDoubleMajorModuleRequirementTags: ModuleRequirementTags[] = mergeModuleRequirementTags([
  ...businessAnalyticsModuleRequirementTags.map(toBzaEconsDoubleMajorMapping),
  ...economicsCoreModuleCodes.map((moduleCode) =>
    createMapping(moduleCode, ["bza-econs-dm-economics-core"])
  ),
  ...economicsRecognizedModuleCodes.map((moduleCode) =>
    createEconomicsElectiveMapping(moduleCode)
  )
]);

export function getCompleteBzaEconsDoubleMajorModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  const inheritedBusinessAnalyticsMappings = getCompleteBusinessAnalyticsModuleRequirementTags(modules)
    .map(toBzaEconsDoubleMajorMapping)
    .filter((mapping) => mapping.tags.length > 0);

  return mergeModuleRequirementTags([
    ...inheritedBusinessAnalyticsMappings,
    ...bzaEconsDoubleMajorModuleRequirementTags,
    ...getGeneratedBzaEconsDoubleMajorModuleRequirementTags(modules)
  ]);
}

const bzaRulesWithoutUnrestrictedElectives = businessAnalyticsRequirementSet.rules.filter(
  (rule) => rule.id !== "ue"
);

export const bzaEconsDoubleMajorRequirementSet: RequirementSet = {
  programme,
  cohort,
  version: 1,
  totalUnits: 160,
  sourceNote: "NUS BZA and Econs Double Major Curriculum AY25/26",
  redirectLink: "https://fass.nus.edu.sg/ecs/requirements-for-economics-major/",
  rules: [
    ...bzaRulesWithoutUnrestrictedElectives,
    {
      id: "economics-second-major-core",
      label: "Economics Second Major Core Courses",
      type: "module-list",
      requiredUnits: 32,
      requiredModules: economicsCoreModuleCodes
    },
    {
      id: "economics-second-major-upper-elective",
      label: "Economics Second Major Level-3000+ Elective",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["bza-econs-dm-economics-level3000-elective"]
    },
    {
      id: "economics-second-major-elective",
      label: "Economics Second Major Elective",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["bza-econs-dm-economics-elective"]
    }
  ]
};

function getGeneratedBzaEconsDoubleMajorModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  return modules.flatMap((module) => {
    const tags: string[] = [];
    if (/^EC\d{4}[A-Z]*$/.test(module.moduleCode)) {
      tags.push("bza-econs-dm-economics-elective");
      if (getModuleLevel(module.moduleCode) >= 3000) {
        tags.push("bza-econs-dm-economics-level3000-elective");
      }
    }

    return tags.length > 0 ? [createMapping(module.moduleCode, tags)] : [];
  });
}

function createEconomicsElectiveMapping(moduleCode: string): ModuleRequirementTags {
  const tags = ["bza-econs-dm-economics-elective"];
  if (getModuleLevel(moduleCode) >= 3000) {
    tags.push("bza-econs-dm-economics-level3000-elective");
  }

  return createMapping(moduleCode, tags);
}

function toBzaEconsDoubleMajorMapping(mapping: ModuleRequirementTags): ModuleRequirementTags {
  return {
    programme,
    cohort,
    moduleCode: mapping.moduleCode,
    tags: mapping.tags.filter((tag) => tag !== "ue")
  };
}

function createMapping(moduleCode: string, tags: string[]): ModuleRequirementTags {
  return { programme, cohort, moduleCode, tags };
}

function mergeModuleRequirementTags(
  mappings: ModuleRequirementTags[]
): ModuleRequirementTags[] {
  const merged = new Map<string, ModuleRequirementTags>();
  for (const mapping of mappings) {
    const existing = merged.get(mapping.moduleCode);
    merged.set(mapping.moduleCode, {
      ...mapping,
      tags: Array.from(new Set([...(existing?.tags ?? []), ...mapping.tags]))
    });
  }
  return Array.from(merged.values());
}

function getModuleLevel(moduleCode: string): number {
  const match = moduleCode.match(/^[A-Z]{2,3}(\d)/);
  return match ? Number(match[1]) * 1000 : 0;
}
