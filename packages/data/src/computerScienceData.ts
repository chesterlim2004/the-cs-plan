import type { Module, ModuleRequirementTags, RequirementSet } from "@the-cs-plan/shared";

export const fallbackModules: Module[] = [
  {
    acadYear: "2025-2026",
    moduleCode: "CS1101S",
    title: "Programming Methodology",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Introduction to programming and computational problem solving."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS1231S",
    title: "Discrete Structures",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Mathematical foundations for computing."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2030S",
    title: "Programming Methodology II",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Object-oriented and functional programming techniques.",
    prerequisite: "CS1101S or equivalent programming experience."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2040S",
    title: "Data Structures and Algorithms",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Design and analysis of data structures and algorithms.",
    prerequisite: "CS1101S or equivalent."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2100",
    title: "Computer Organisation",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Computer organisation and architecture."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "MA1521",
    title: "Calculus for Computing",
    units: 4,
    department: "Mathematics",
    faculty: "Faculty of Science",
    description: "Calculus topics for computing students."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "IS1108",
    title: "Digital Ethics and Data Privacy",
    units: 4,
    department: "Information Systems and Analytics",
    faculty: "School of Computing",
    description: "Ethics, privacy, and responsibility in digital systems."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "GEA1000",
    title: "Quantitative Reasoning with Data",
    units: 4,
    department: "General Education",
    faculty: "NUS",
    description: "Quantitative reasoning and data literacy."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "ES2660",
    title: "Communicating in the Information Age",
    units: 4,
    department: "Centre for English Language Communication",
    faculty: "NUS",
    description: "Communication skills for information-age contexts."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CP3200",
    title: "Internship",
    units: 6,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Industry experience module."
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2101",
    title: "Effective Communication for Computing Professionals",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing"
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2103T",
    title: "Software Engineering",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing"
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2106",
    title: "Introduction to Operating Systems",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing"
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2109S",
    title: "Introduction to AI and Machine Learning",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing"
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS3230",
    title: "Design and Analysis of Algorithms",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing"
  },
  {
    acadYear: "2025-2026",
    moduleCode: "MA1522",
    title: "Linear Algebra for Computing",
    units: 4,
    department: "Mathematics",
    faculty: "Faculty of Science"
  },
  {
    acadYear: "2025-2026",
    moduleCode: "ST2334",
    title: "Probability and Statistics",
    units: 4,
    department: "Statistics and Data Science",
    faculty: "Faculty of Science"
  },
  {
    acadYear: "2025-2026",
    moduleCode: "BT1101",
    title: "Introduction to Business Analytics",
    units: 4,
    department: "Information Systems and Analytics",
    faculty: "School of Computing"
  }
];

export const csModuleRequirementTags: ModuleRequirementTags[] = [
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS1101S",
    tags: ["digital-literacy"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS1231S",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS2030S",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS2040S",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS2100",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "MA1521",
    tags: ["cs-math"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "IS1108",
    tags: ["computer-ethics"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "GEA1000",
    tags: ["data-literacy"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "ES2660",
    tags: ["critique-and-expression"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CP3200",
    tags: ["cs-breadth-and-depth"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS2101",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS2103T",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS2106",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS2109S",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS3230",
    tags: ["cs-foundation"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "MA1522",
    tags: ["cs-math"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "ST2334",
    tags: ["cs-math"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "CS1010X",
    tags: ["digital-literacy"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "BT1101",
    tags: ["data-literacy"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "ST1131",
    tags: ["data-literacy"]
  },
  {
    programme: "computer-science",
    cohort: "AY2025/26",
    moduleCode: "DSA1101",
    tags: ["data-literacy"]
  }
];

const csIdModuleCodes = [
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

const csCdModuleCodes = [
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

const csFocusAreas = [
  {
    id: "algorithms-theory",
    label: "Algorithms & Theory",
    primaryModules: ["CS3230", "CS3231", "CS3236", "CS4231", "CS4234", "CS4330", "CS4430"],
    electiveModules: ["CS3233", "CS4257", "CS4261", "CS4268", "CS4269", "CS4330", "CS5234", "CS5236", "CS5237", "CS5238", "CS5330"]
  },
  {
    id: "artificial-intelligence",
    label: "Artificial Intelligence",
    primaryModules: ["CS2109S", "CS3243", "CS3244", "CS3263", "CS3264", "CS3268", "CS4243", "CS4244", "CS4246", "CS4248", "CS4262", "CS4263"],
    electiveModules: ["CS4220", "CS4261", "CS4269", "CS4277", "CS4278", "CS5215", "CS5228", "CS5242", "CS5260", "CS5340", "CS5339"]
  },
  {
    id: "graphics-games",
    label: "Computer Graphics and Games",
    primaryModules: ["CS3241", "CS3242", "CS3247", "CS4247", "CS4350"],
    electiveModules: ["CS3218", "CS3240", "CS3249", "CS4240", "CS4243", "CS4249", "CS4351", "CS5237", "CS5240", "CS5343", "CS5346"]
  },
  {
    id: "computer-security",
    label: "Computer Security",
    primaryModules: ["CS2107", "CS3235", "CS4236", "CS4230", "CS4238", "CS4239"],
    electiveModules: ["CS3221", "CS4257", "CS4276", "CS5231", "CS5250", "CS5321", "CS5322", "CS5331", "CS5332", "IFS4101", "IFS4102", "IFS4103"]
  },
  {
    id: "database-systems",
    label: "Database Systems",
    primaryModules: ["CS2102", "CS3223", "CS4221", "CS4224", "CS4225"],
    electiveModules: ["CS4220", "CS5226", "CS5228", "CS5322"]
  },
  {
    id: "human-computer-interaction",
    label: "Human-Computer Interaction",
    primaryModules: ["CS2111", "CS3240", "CS3249", "CS4249", "CS4353"],
    electiveModules: ["CS4240", "CS5346"]
  },
  {
    id: "multimedia-information-retrieval",
    label: "Multimedia Information Retrieval",
    primaryModules: ["CS2108", "CS3245", "CS4242", "CS4248", "CS4347"],
    electiveModules: ["CS5246", "CS5241"]
  },
  {
    id: "networking-distributed-systems",
    label: "Networking and Distributed Systems",
    primaryModules: ["CS2105", "CS3103", "CS4222", "CS4226", "CS4231"],
    electiveModules: ["CS3237", "CS4344", "CS5223", "CS5224", "CS5229", "CS5248", "CS5321"]
  },
  {
    id: "parallel-computing",
    label: "Parallel Computing",
    primaryModules: ["CS3210", "CS3211", "CS4231", "CS4223"],
    electiveModules: ["CS5222", "CS5223", "CS5224", "CS5239", "CS5250"]
  },
  {
    id: "programming-languages",
    label: "Programming Languages",
    primaryModules: ["CS2104", "CS3211", "CS4212", "CS4215"],
    electiveModules: ["CS3234", "CS4216", "CS5232", "CS5215", "CS5218"]
  },
  {
    id: "software-engineering",
    label: "Software Engineering",
    primaryModules: ["CS2103T", "CS3213", "CS3217", "CS3219", "CS3227", "CS3282", "CS4211", "CS4218", "CS4239"],
    electiveModules: ["CS3203", "CS3281", "CS3216", "CS3226", "CS3234", "CS5219", "CS5232", "CS5272"]
  }
];

const csBreadthAndDepthModuleCodes = Array.from(new Set(
  csFocusAreas.flatMap((area) => [...area.primaryModules, ...area.electiveModules])
));

const csIndustryExperienceModuleCodes = [
  "CP3880",
  "IS4010",
  "ETP3201L",
  "CP3200",
  "CP3202",
  "CP3107",
  "CP3110",
  "ETP3205"
];

export const generatedCsModuleRequirementTags: ModuleRequirementTags[] = [
  ...csIdModuleCodes.map((moduleCode) => ({
    programme: "computer-science" as const,
    cohort: "AY2025/26" as const,
    moduleCode,
    tags: ["id"]
  })),
  ...csCdModuleCodes.map((moduleCode) => ({
    programme: "computer-science" as const,
    cohort: "AY2025/26" as const,
    moduleCode,
    tags: ["cd"]
  })),
  ...csBreadthAndDepthModuleCodes.map((moduleCode) => ({
    programme: "computer-science" as const,
    cohort: "AY2025/26" as const,
    moduleCode,
    tags: ["cs-breadth-and-depth"]
  })),
  ...csIndustryExperienceModuleCodes.map((moduleCode) => ({
    programme: "computer-science" as const,
    cohort: "AY2025/26" as const,
    moduleCode,
    tags: ["cs-breadth-and-depth", "cs-bd-industry"]
  })),
  {
    programme: "computer-science" as const,
    cohort: "AY2025/26" as const,
    moduleCode: "CP4101",
    tags: ["cs-breadth-and-depth", "cs-bd-dissertation"]
  }
];

export function getGeneratedCsModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  return modules.flatMap((module) => {
    const tags: string[] = [];
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
      module.moduleCode.startsWith("PC") ||
      module.moduleCode.startsWith("CM") ||
      module.moduleCode.startsWith("LSM") ||
      module.moduleCode.startsWith("ZB")
    ) {
      tags.push("cd");
    }

    return tags.length > 0
      ? [{
          programme: "computer-science",
          cohort: "AY2025/26",
          moduleCode: module.moduleCode,
          tags
        }]
      : [];
  });
}

export function getCompleteCsModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>
): ModuleRequirementTags[] {
  const ay2526NonUeMappings = mergeModuleRequirementTags([
    ...csModuleRequirementTags,
    ...generatedCsModuleRequirementTags,
    ...getGeneratedCsModuleRequirementTags(modules)
  ]);

  const ay2526Mappings = mergeModuleRequirementTags([
    ...ay2526NonUeMappings,
    ...getGeneratedCsUeModuleRequirementTags(modules, ay2526NonUeMappings)
  ]);

  return mergeModuleRequirementTags(
    (["AY2025/26", "AY2026/27"] as const).flatMap((cohort) =>
      ay2526Mappings.map((mapping) => ({ ...mapping, cohort }))
    )
  );
}

export function getGeneratedCsUeModuleRequirementTags(
  modules: Array<Pick<Module, "moduleCode">>,
  existingMappings: ModuleRequirementTags[]
): ModuleRequirementTags[] {
  const taggedModuleCodes = new Set(
    existingMappings
      .filter((mapping) =>
        mapping.programme === "computer-science" &&
        mapping.cohort === "AY2025/26" &&
        mapping.tags.length > 0
      )
      .map((mapping) => mapping.moduleCode)
  );

  return modules
    .filter((module) => !taggedModuleCodes.has(module.moduleCode))
    .map((module) => ({
      programme: "computer-science" as const,
      cohort: "AY2025/26" as const,
      moduleCode: module.moduleCode,
      tags: ["ue"]
    }));
}

function mergeModuleRequirementTags(
  mappings: ModuleRequirementTags[]
): ModuleRequirementTags[] {
  const merged = new Map<string, ModuleRequirementTags>();

  for (const mapping of mappings) {
    const key = `${mapping.programme}:${mapping.cohort}:${mapping.moduleCode}`;
    const existing = merged.get(key);
    merged.set(key, {
      ...mapping,
      tags: Array.from(new Set([...(existing?.tags ?? []), ...mapping.tags]))
    });
  }

  return Array.from(merged.values());
}

export const csRequirementSet: RequirementSet = {
  programme: "computer-science",
  cohort: "AY2026/27",
  version: 1,
  totalUnits: 160,
  sourceNote:
    "Removed outdated CS modules for cloning, updated breadth and depth modules to full list",
  redirectLink: "https://www.comp.nus.edu.sg/cug/per-cohort/cs/cs-26-27/",
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
      id: "computer-ethics",
      label: "Computer Ethics",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["computer-ethics"]
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
      id: "cs-foundation",
      label: "CS Foundation",
      type: "units-from-tags",
      requiredUnits: 36,
      acceptedTags: ["cs-foundation"],
      acceptedPlaceholders: ["cs-foundation"]
    },
    {
      id: "cs-breadth-and-depth",
      label: "CS Breadth and Depth",
      type: "structured-breadth-depth",
      requiredUnits: 32,
      acceptedTags: ["cs-breadth-and-depth"],
      industryTags: ["cs-bd-industry"],
      dissertationTags: ["cs-bd-dissertation"],
      focusAreas: csFocusAreas,
      requiredFocusAreaPrimaryCount: 3,
      requiredFocusAreaLevel4000PrimaryCount: 1,
      requiredLevel4000Units: 12,
      requiredIndustryMinUnits: 6,
      requiredIndustryMaxUnits: 12,
      allowedNonIndustryPrefixes: ["CS", "IFS", "CP"],
      maxNonIndustryCpUnits: 12
    },
    {
      id: "cs-math",
      label: "Mathematics and Sciences",
      type: "units-from-tags",
      requiredUnits: 12,
      acceptedTags: ["cs-math"]
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

export const csAy2025RequirementSet: RequirementSet = {
  ...csRequirementSet,
  cohort: "AY2025/26",
  version: 2,
  redirectLink: "https://www.comp.nus.edu.sg/cug/per-cohort/cs/cs-25-26/",
  sourceNote:
    "Removed outdated CS modules for cloning, updated breadth and depth modules to full list"
};
