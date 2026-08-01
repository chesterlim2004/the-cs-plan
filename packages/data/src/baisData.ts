import type { Module, ModuleRequirementTags, RequirementSet } from "@the-cs-plan/shared";

const programme = "business-artificial-intelligence-systems" as const;
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
  "BT2102",
  "CS2030",
  "CS2040",
  "IS2101",
  "IS2108",
  "IS2109",
  "IS3103",
  "IS4108",
  "MA1521",
  "MA1522",
  "ST2334"
];

const programmeElectiveModuleCodes = [
  "IS3150",
  "IS3240",
  "IS4262",
  "IS4226",
  "IS4228",
  "IS4302",
  "IS4303",
  "CS2105",
  "IS2102",
  "IS3108",
  "IS3221",
  "IS4100",
  "IS4234",
  "IS4236",
  "IS4243",
  "IS4248",
  "IS4250",
  "IS4301",
  "BT3017",
  "BT4014",
  "BT4221",
  "BT4301",
  "IS3107",
  "IS3109",
  "IS4151",
  "IS4246",
  "IS4400",
  "IS4401",
  "IS4402",
  "IS4403",
  "CP3100",
  "IS3251",
  "IS4152",
  "IS4241",
  "IS4261",
  "CS2107",
  "IFS4101",
  "IS4231",
  "IS4233",
  "IS4238"
];

export const baisModuleRequirementTags: ModuleRequirementTags[] = mergeModuleRequirementTags([
  createMapping("CS1010A", ["digital-literacy"]),
  createMapping("UTC2851", ["digital-literacy"]),
  createMapping("BT1101", ["data-literacy"]),
  createMapping("IS1108", ["computing-ethics"]),
  ...idModuleCodes.map((moduleCode) => createMapping(moduleCode, ["id"])),
  ...cdModuleCodes.map((moduleCode) => createMapping(moduleCode, ["cd"])),
  ...coreModuleCodes.map((moduleCode) => createMapping(moduleCode, ["bais-core"])),
  ...programmeElectiveModuleCodes.map((moduleCode) =>
    createMapping(moduleCode, ["bais-programme-elective"])
  ),
  createMapping("CP3880", ["bais-ier-full", "ue"]),
  createMapping("IS4010", ["bais-ier-full", "ue"]),
  createMapping("ETP3206L", ["bais-ier-full-12", "ue"]),
  createMapping("CP3200", ["bais-ier-foundation", "ue"]),
  createMapping("CP3202", ["bais-ier-second-internship", "ue"]),
  ...["CP3201", "CS4352", "IS4236", "IS4243", "IS4301", "BT4301"].map(
    (moduleCode) => createMapping(moduleCode, ["bais-ier-supplementary", "ue"])
  ),
  createMapping("CP4101", ["bais-ier-dissertation", "ue"]),
  createMapping("ETP3202L", ["bais-ier-dissertation-8", "ue"]),
  createMapping("ETP3203L", [
    "bais-ier-dissertation-4",
    "bais-programme-elective",
    "ue"
  ])
]);

export function getCompleteBaisModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  const nonUeMappings = mergeModuleRequirementTags([
    ...baisModuleRequirementTags,
    ...getGeneratedBaisModuleRequirementTags(modules)
  ]);
  const mappedModuleCodes = new Set(nonUeMappings.map((mapping) => mapping.moduleCode));

  return mergeModuleRequirementTags([
    ...nonUeMappings,
    ...modules
      .filter((module) => !mappedModuleCodes.has(module.moduleCode))
      .map((module) => createMapping(module.moduleCode, ["ue"]))
  ]);
}

export const baisRequirementSet: RequirementSet = {
  programme,
  cohort,
  version: 1,
  totalUnits: 160,
  sourceNote: "NUS Computing BComp Business Artificial Intelligence Systems curriculum: https://www.comp.nus.edu.sg/programmes/ug/bais/curr/",
  redirectLink: "https://www.comp.nus.edu.sg/cug/per-cohort/bais/bais-25-26/",
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
      id: "bais-core",
      label: "Business Artificial Intelligence Systems Core Courses",
      type: "module-list",
      requiredUnits: 48,
      requiredModules: coreModuleCodes
    },
    {
      id: "industry-experience",
      label: "Industry Experience Requirement",
      type: "structured-industry-experience",
      requiredUnits: 12,
      industryTags: ["bais-ier-full", "bais-ier-full-12"],
      internshipFoundationTags: ["bais-ier-foundation"],
      secondInternshipTags: ["bais-ier-second-internship"],
      supplementaryTags: ["bais-ier-supplementary"],
      requiredFoundationUnits: 6,
      requiredCompanionUnits: 6,
      dissertationTags: [
        "bais-ier-dissertation",
        "bais-ier-dissertation-8",
        "bais-ier-dissertation-4"
      ],
      tagUnitOverrides: [
        { tag: "bais-ier-full-12", units: 12 },
        { tag: "bais-ier-dissertation-8", units: 8 },
        { tag: "bais-ier-dissertation-4", units: 4 }
      ],
      advisory: "CP4101 dissertation replacement is subject to the published GPA and completed-unit eligibility conditions."
    },
    {
      id: "programme-electives",
      label: "Business Artificial Intelligence Systems Programme Electives",
      type: "structured-programme-electives",
      requiredUnits: 20,
      acceptedTags: ["bais-programme-elective"],
      requiredMinCourses: 5,
      requiredLevel4000MinCourses: 3,
      requiredPrefixMinCourses: 0,
      requiredPrefixes: []
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

function getGeneratedBaisModuleRequirementTags(
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
