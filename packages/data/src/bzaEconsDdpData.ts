import type { Module, ModuleRequirementTags, RequirementSet } from "@the-cs-plan/shared";

const programme = "business-analytics-economics-double-degree" as const;
const cohort = "AY2025/26" as const;

const bzaCoreModuleCodes = [
  "BT2101",
  "BT2102",
  "CS2030",
  "CS2040",
  "BT3103",
  "IS3103",
  "BT4103"
];

const economicsCoreModuleCodes = [
  "EC1101E",
  "EC2101",
  "EC2102",
  "EC3101",
  "EC3102",
  "EC3303"
];

const commonCourseModuleCodes = [
  "BT1101",
  "CS1010A",
  "CS1010S",
  "FAS1101",
  "IS2101",
  "MA1521",
  "MA2002",
  "ST2334"
];

const bzaProgrammeElectiveModuleCodes = [
  "IE3120",
  "IS3150",
  "IS3240",
  "BT4013",
  "BT4016",
  "BT4211",
  "BT4212",
  "DBA4811",
  "IS4241",
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

export const bzaEconsDdpModuleRequirementTags: ModuleRequirementTags[] =
  mergeModuleRequirementTags([
    ...bzaCoreModuleCodes.map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-bza-core"])
    ),
    ...["MA1522", "MA2001"].map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-bza-core"])
    ),
    ...economicsCoreModuleCodes.map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-economics-core"])
    ),
    ...commonCourseModuleCodes.map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-common-course"])
    ),
    ...["FAS1101", "IS2101"].map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-writing"])
    ),
    createMapping("HSA1000", ["bza-econs-ddp-asian-studies"]),
    createMapping("HSH1000", ["bza-econs-ddp-humanities"]),
    createMapping("HSS1000", ["bza-econs-ddp-social-sciences"]),
    ...["HS1501", "IT1244"].map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-artificial-intelligence"])
    ),
    createMapping("DTK1234", ["bza-econs-ddp-design-thinking"]),
    ...["HSI1000", "SP2274"].map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-scientific-inquiry-1"])
    ),
    createMapping("SP3275", ["bza-econs-ddp-scientific-inquiry-2"]),
    createMapping("IS1108", ["bza-econs-ddp-computing-ethics"]),
    ...bzaProgrammeElectiveModuleCodes.map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-bza-programme-elective"])
    ),
    createMapping("CP3880", ["bza-econs-ddp-ier-full"]),
    createMapping("IS4010", ["bza-econs-ddp-ier-full"]),
    createMapping("ETP3206L", ["bza-econs-ddp-ier-full-12"]),
    createMapping("CP3200", ["bza-econs-ddp-ier-foundation"]),
    createMapping("CP3202", ["bza-econs-ddp-ier-second-internship"]),
    ...["CP3201", "CS4352", "IS4236", "IS4243", "BT4301"].map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-ier-supplementary"])
    ),
    createMapping("ETP3203L", ["bza-econs-ddp-bza-programme-elective"]),
    ...["XFC4101", "XFA4414"].map((moduleCode) =>
      createMapping(moduleCode, ["bza-econs-ddp-integrated-thesis"])
    )
  ]);

export function getCompleteBzaEconsDdpModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  const classifiedMappings = mergeModuleRequirementTags([
    ...bzaEconsDdpModuleRequirementTags,
    ...getGeneratedBzaEconsDdpModuleRequirementTags(modules)
  ]);
  const classifiedModuleCodes = new Set(
    classifiedMappings.map((mapping) => mapping.moduleCode)
  );

  return mergeModuleRequirementTags([
    ...classifiedMappings,
    ...modules
      .filter((module) => !classifiedModuleCodes.has(module.moduleCode))
      .map((module) => createMapping(module.moduleCode, ["ue"]))
  ]);
}

export const bzaEconsDdpRequirementSet: RequirementSet = {
  programme,
  cohort,
  version: 1,
  totalUnits: 172,
  sourceNote:
    "NUS Computing BSc Business Analytics (Hons) and BSocSci Economics (Hons) DDP AY2025/26 curriculum: https://www.comp.nus.edu.sg/cug/per-cohort/ddp-ba-econs/ddp-ba-econs-cohort-2025-2026/ and https://www.comp.nus.edu.sg/wp-content/uploads/2026/02/PR_BZA_Econs_DoubleHonsDDP2025-26-2.pdf",
  redirectLink: "https://www.comp.nus.edu.sg/cug/per-cohort/ddp-ba-econs/ddp-ba-econs-cohort-2025-2026/",
  rules: [
    {
      id: "chs-soc-common-curriculum",
      label: "General Education and CHS-SoC Common Curriculum",
      type: "capped-units-from-tags",
      requiredUnits: 44,
      acceptedTags: [
        "bza-econs-ddp-asian-studies",
        "bza-econs-ddp-humanities",
        "bza-econs-ddp-social-sciences",
        "bza-econs-ddp-communities-engagement",
        "bza-econs-ddp-artificial-intelligence",
        "bza-econs-ddp-design-thinking",
        "bza-econs-ddp-scientific-inquiry-1",
        "bza-econs-ddp-scientific-inquiry-2",
        "bza-econs-ddp-interdisciplinary-1",
        "bza-econs-ddp-interdisciplinary-2",
        "bza-econs-ddp-computing-ethics"
      ],
      tagCaps: [
        { tag: "bza-econs-ddp-asian-studies", maxUnits: 4 },
        { tag: "bza-econs-ddp-humanities", maxUnits: 4 },
        { tag: "bza-econs-ddp-social-sciences", maxUnits: 4 },
        { tag: "bza-econs-ddp-communities-engagement", maxUnits: 4 },
        { tag: "bza-econs-ddp-artificial-intelligence", maxUnits: 4 },
        { tag: "bza-econs-ddp-design-thinking", maxUnits: 4 },
        { tag: "bza-econs-ddp-scientific-inquiry-1", maxUnits: 4 },
        { tag: "bza-econs-ddp-scientific-inquiry-2", maxUnits: 4 },
        { tag: "bza-econs-ddp-interdisciplinary-1", maxUnits: 4 },
        { tag: "bza-econs-ddp-interdisciplinary-2", maxUnits: 4 },
        { tag: "bza-econs-ddp-computing-ethics", maxUnits: 4 }
      ]
    },
    {
      id: "bza-core",
      label: "Business Analytics Core Courses",
      type: "module-list",
      requiredUnits: 32,
      requiredModules: bzaCoreModuleCodes
    },
    {
      id: "bza-linear-algebra",
      label: "Business Analytics Linear Algebra",
      type: "module-choice",
      requiredUnits: 4,
      moduleOptions: [["MA1522"], ["MA2001"]]
    },
    {
      id: "economics-core",
      label: "Economics Core Courses",
      type: "module-list",
      requiredUnits: 24,
      requiredModules: economicsCoreModuleCodes
    },
    {
      id: "common-fixed-courses",
      label: "Common Courses",
      type: "module-list",
      requiredUnits: 8,
      requiredModules: ["BT1101", "ST2334"]
    },
    {
      id: "common-programming",
      label: "Common Programming Course",
      type: "module-choice",
      requiredUnits: 4,
      moduleOptions: [["CS1010A"], ["CS1010S"]]
    },
    {
      id: "common-writing",
      label: "Common Writing Course",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["bza-econs-ddp-writing"]
    },
    {
      id: "common-calculus",
      label: "Common Calculus Course",
      type: "module-choice",
      requiredUnits: 4,
      moduleOptions: [["MA1521"], ["MA2002"]]
    },
    {
      id: "honours-pathway",
      label: "Integrated Thesis or Internship Honours Pathway",
      type: "structured-ddp-honours-pathway",
      requiredUnits: 28,
      integratedThesisTags: ["bza-econs-ddp-integrated-thesis"],
      economicsElectiveTags: ["bza-econs-ddp-economics-elective"],
      economicsLevel4000Tags: ["bza-econs-ddp-economics-level4000"],
      industryTags: ["bza-econs-ddp-ier-full", "bza-econs-ddp-ier-full-12"],
      internshipFoundationTags: ["bza-econs-ddp-ier-foundation"],
      secondInternshipTags: ["bza-econs-ddp-ier-second-internship"],
      supplementaryTags: ["bza-econs-ddp-ier-supplementary"],
      integratedThesisUnits: 12,
      integratedEconomicsUnits: 16,
      integratedEconomicsLevel4000Units: 8,
      requiredFoundationUnits: 6,
      requiredCompanionUnits: 6,
      internshipEconomicsUnits: 28,
      internshipEconomicsLevel4000Units: 20,
      internshipPathwayRequiredUnits: 40,
      tagUnitOverrides: [{ tag: "bza-econs-ddp-ier-full-12", units: 12 }],
      advisory:
        "Students aiming for Honours (Highest Distinction) in Business Analytics must use the integrated thesis route."
    },
    {
      id: "bza-programme-electives",
      label: "Business Analytics Programme Electives",
      type: "structured-programme-electives",
      requiredUnits: 20,
      acceptedTags: ["bza-econs-ddp-bza-programme-elective"],
      requiredMinCourses: 5,
      requiredLevel4000MinCourses: 3,
      requiredPrefixMinCourses: 3,
      requiredPrefixes: ["BT"]
    }
  ]
};

function getGeneratedBzaEconsDdpModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  const economicsCore = new Set(economicsCoreModuleCodes);

  return modules.flatMap((module) => {
    const { moduleCode } = module;
    const tags: string[] = [];

    if (moduleCode.startsWith("GEN")) {
      tags.push("bza-econs-ddp-communities-engagement");
    }
    if (/^HSI2\d{3}[A-Z]*$/.test(moduleCode)) {
      tags.push("bza-econs-ddp-scientific-inquiry-2");
    }
    if (/^HS29\d{2}[A-Z]*$/.test(moduleCode)) {
      tags.push(
        "bza-econs-ddp-interdisciplinary-1",
        "bza-econs-ddp-interdisciplinary-2"
      );
    }
    if (/^UTW(?:1001|2001)[A-Z]+$/.test(moduleCode)) {
      tags.push("bza-econs-ddp-writing");
    }

    const economicsMatch = /^EC(\d{4})[A-Z]*$/.exec(moduleCode);
    const economicsLevel = economicsMatch ? Number(economicsMatch[1]) : 0;
    if (economicsLevel >= 3000 && !economicsCore.has(moduleCode)) {
      tags.push("bza-econs-ddp-economics-elective");
    }
    if (economicsLevel >= 4000 && !economicsCore.has(moduleCode)) {
      tags.push("bza-econs-ddp-economics-level4000");
    }

    return tags.length > 0 ? [createMapping(moduleCode, tags)] : [];
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
