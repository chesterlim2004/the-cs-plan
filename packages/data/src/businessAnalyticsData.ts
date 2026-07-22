import type { Module, ModuleRequirementTags, RequirementSet } from "@the-cs-plan/shared";

const programme = "business-analytics" as const;
const cohort = "AY2025/26" as const;

const idModuleCodes = [
  "CDE2501",
  "EG2501",
  "DTK1234",
  "EG1311",
  "IE2141",
  "PF1101A",
  "PF1101",
  "IS1128",
  "IS2218",
  "IS2238",
  "HSH1000",
  "HSS1000",
  "HSA1000",
  "HSI1000",
  "HSI2001",
  "HSI2002",
  "HSI2003",
  "HSI2004",
  "HSI2005",
  "HSI2007",
  "HSI2008",
  "HSI2009",
  "HSI2010",
  "HSI2011",
  "HSI2013",
  "HSI2014"
];

const cdModuleCodes = [
  "ACC1701",
  "ACC1701X",
  "ACC1701XA",
  "ACC1701XB",
  "ACC1701XC",
  "ACC1701XD",
  "DAO2703",
  "MNO1706X",
  "SC1101E",
  "EL1101E",
  "PE2101P",
  "GE2103",
  "XD3103",
  "GE3253",
  "GE3255",
  "GE3256",
  "SPH2002",
  "SC2226",
  "NUR1113A",
  "CDE2300",
  "CDE2310",
  "EG2201A",
  "EG2310"
];

const coreModuleCodes = [
  "MA1521",
  "MA1522",
  "BT2101",
  "BT2102",
  "CS2030",
  "CS2040",
  "IS2101",
  "BT3103",
  "IS3103",
  "BT4103"
];

const statisticsOptionModuleCodes = ["ST2334", "ST2131", "MA2116", "MA2116T", "ST2132"];

const programmeElectiveModuleCodes = [
  "IE3120",
  "IS3150",
  "IS3240",
  "BT4013",
  "BT4016",
  "BT4211",
  "BT4212",
  "DBA4811",
  "IS4241",
  "IS4242",
  "IS4250",
  "IS4262",
  "BT3017",
  "BT3102",
  "BT3104",
  "CP3100",
  "CS3243",
  "CS3244",
  "CS4248",
  "BT4012",
  "BT4015",
  "BT4221",
  "BT4222",
  "BT4240",
  "BT4241",
  "ST4245",
  "IS3107",
  "IS3221",
  "BT4014",
  "BT4301",
  "IS4226",
  "IS4228",
  "IS4234",
  "IS4246",
  "IS4302",
  "IS4303"
];

export const businessAnalyticsModuleRequirementTags: ModuleRequirementTags[] = mergeModuleRequirementTags([
  createMapping("CS1010A", ["digital-literacy"]),
  createMapping("UTC2851", ["digital-literacy"]),
  createMapping("BT1101", ["data-literacy"]),
  createMapping("IS1108", ["computing-ethics"]),
  ...idModuleCodes.map((moduleCode) => createMapping(moduleCode, ["id"])),
  ...cdModuleCodes.map((moduleCode) => createMapping(moduleCode, ["cd"])),
  ...coreModuleCodes.map((moduleCode) => createMapping(moduleCode, ["ba-core"])),
  ...statisticsOptionModuleCodes.map((moduleCode) =>
    createMapping(moduleCode, ["ba-statistics-alternative"])
  ),
  ...programmeElectiveModuleCodes.map((moduleCode) =>
    createMapping(moduleCode, ["ba-programme-elective"])
  ),
  createMapping("CP3880", ["ba-ier-full", "ue"]),
  createMapping("IS4010", ["ba-ier-full", "ue"]),
  createMapping("ETP3206L", ["ba-ier-full-12", "ue"]),
  createMapping("CP3200", ["ba-ier-foundation", "ue"]),
  createMapping("CP3202", ["ba-ier-second-internship", "ue"]),
  ...["CP3201", "CS4352", "IS4236", "IS4243", "BT4301"].map((moduleCode) =>
    createMapping(moduleCode, ["ba-ier-supplementary", "ue"])
  ),
  createMapping("BT4101", ["ba-ier-dissertation", "ue"]),
  createMapping("ETP3202L", ["ba-ier-dissertation-8", "ue"]),
  createMapping("ETP3203L", [
    "ba-ier-dissertation-4",
    "ba-programme-elective",
    "ue"
  ])
]);

export function getCompleteBusinessAnalyticsModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  const nonUeMappings = mergeModuleRequirementTags([
    ...businessAnalyticsModuleRequirementTags,
    ...getGeneratedBusinessAnalyticsModuleRequirementTags(modules)
  ]);
  const mappedModuleCodes = new Set(nonUeMappings.map((mapping) => mapping.moduleCode));

  return mergeModuleRequirementTags([
    ...nonUeMappings,
    ...modules
      .filter((module) => !mappedModuleCodes.has(module.moduleCode))
      .map((module) => createMapping(module.moduleCode, ["ue"]))
  ]);
}

export const businessAnalyticsRequirementSet: RequirementSet = {
  programme,
  cohort,
  version: 3,
  totalUnits: 160,
  sourceNote: "NUS Computing BSc Business Analytics curriculum: https://www.comp.nus.edu.sg/programmes/ug/ba/curr/",
  rules: [
    {
      id: "university-pillars",
      label: "University Pillars",
      type: "capped-units-from-tags",
      requiredUnits: 24,
      acceptedTags: [
        "digital-literacy",
        "critique-and-expression",
        "cultures-and-connections",
        "data-literacy",
        "singapore-studies",
        "communities-and-engagement"
      ],
      tagCaps: [
        { tag: "digital-literacy", maxUnits: 4 },
        { tag: "critique-and-expression", maxUnits: 4 },
        { tag: "cultures-and-connections", maxUnits: 4 },
        { tag: "data-literacy", maxUnits: 4 },
        { tag: "singapore-studies", maxUnits: 4 },
        { tag: "communities-and-engagement", maxUnits: 4 }
      ]
    },
    {
      id: "computing-ethics",
      label: "Computing Ethics",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["computing-ethics"]
    },
    {
      id: "idcd",
      label: "ID/CD Requirement",
      type: "structured-idcd",
      requiredUnits: 12,
      idTags: ["id"],
      cdTags: ["cd"],
      acceptedPlaceholders: ["id", "cd"],
      requiredIdMinCourses: 2,
      allowedCdMaxCourses: 1
    },
    {
      id: "business-analytics-core",
      label: "Business Analytics Core Courses",
      type: "module-list",
      requiredUnits: 44,
      requiredModules: coreModuleCodes
    },
    {
      id: "probability-statistics",
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
      id: "industry-experience",
      label: "Industry Experience Requirement",
      type: "structured-industry-experience",
      requiredUnits: 12,
      industryTags: ["ba-ier-full", "ba-ier-full-12"],
      internshipFoundationTags: ["ba-ier-foundation"],
      secondInternshipTags: ["ba-ier-second-internship"],
      supplementaryTags: ["ba-ier-supplementary"],
      requiredFoundationUnits: 6,
      requiredCompanionUnits: 6,
      dissertationTags: [
        "ba-ier-dissertation",
        "ba-ier-dissertation-8",
        "ba-ier-dissertation-4"
      ],
      tagUnitOverrides: [
        { tag: "ba-ier-full-12", units: 12 },
        { tag: "ba-ier-dissertation-8", units: 8 },
        { tag: "ba-ier-dissertation-4", units: 4 }
      ],
      advisory: "BT4101 dissertation replacement is subject to the published GPA and completed-unit eligibility conditions."
    },
    {
      id: "programme-electives",
      label: "Business Analytics Programme Electives",
      type: "structured-programme-electives",
      requiredUnits: 20,
      acceptedTags: ["ba-programme-elective"],
      requiredMinCourses: 5,
      requiredLevel4000MinCourses: 3,
      requiredPrefixMinCourses: 3,
      requiredPrefixes: ["BT"]
    },
    {
      id: "ue",
      label: "Unrestricted Electives",
      type: "residual-units",
      requiredUnits: 40,
      acceptedTags: ["ue"],
      acceptedPlaceholders: ["ue"]
    }
  ]
};

function getGeneratedBusinessAnalyticsModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  return modules.flatMap((module) => {
    const tags: string[] = [];
    if (module.moduleCode.startsWith("GEX")) {
      tags.push("critique-and-expression");
    }
    if (module.moduleCode.startsWith("GEC")) {
      tags.push("cultures-and-connections");
    }
    if (module.moduleCode.startsWith("GES")) {
      tags.push("singapore-studies");
    }
    if (module.moduleCode.startsWith("GEN")) {
      tags.push("communities-and-engagement");
    }
    if (
      module.moduleCode.startsWith("PC")
      || module.moduleCode.startsWith("CM")
      || module.moduleCode.startsWith("LSM")
      || module.moduleCode.startsWith("ZB")
    ) {
      tags.push("cd");
    }

    return tags.length > 0 ? [createMapping(module.moduleCode, tags)] : [];
  });
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
