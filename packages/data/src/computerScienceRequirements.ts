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
    tags: ["data-literacy"]
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

const csBreadthAndDepthModuleCodes = [
  "CS3230",
  "CS3231",
  "CS3236",
  "CS4231",
  "CS4234",
  "CS3243",
  "CS3244",
  "CS4243",
  "CS4244",
  "CS4246",
  "CS4248",
  "CS3241",
  "CS3242",
  "CS4247",
  "CS4249",
  "CS2107",
  "CS3235",
  "CS4236",
  "CS4238",
  "CS4239",
  "CS2102",
  "CS3223",
  "CS4221",
  "CS4225",
  "CS3245",
  "CS3246",
  "CS4242",
  "CS4347",
  "CS2105",
  "CS3204",
  "CS3237",
  "CS4222",
  "CS4226",
  "CS3210",
  "CS4232",
  "CS2104",
  "CS3211",
  "CS4212",
  "CS4215",
  "CS3219",
  "CS3203",
  "CS4211",
  "CS4218"
];

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

const csFocusAreas = [
  {
    id: "algorithms-theory",
    label: "Algorithms & Theory",
    primaryModules: ["CS3230", "CS3231", "CS3236"],
    electiveModules: ["CS4231", "CS4234"]
  },
  {
    id: "artificial-intelligence",
    label: "Artificial Intelligence",
    primaryModules: ["CS3243", "CS3244"],
    electiveModules: ["CS4243", "CS4244", "CS4246", "CS4248"]
  },
  {
    id: "graphics-games",
    label: "Computer Graphics and Games",
    primaryModules: ["CS3241", "CS3242"],
    electiveModules: ["CS4247", "CS4249"]
  },
  {
    id: "computer-security",
    label: "Computer Security",
    primaryModules: ["CS2107", "CS3235"],
    electiveModules: ["CS4236", "CS4238", "CS4239"]
  },
  {
    id: "database-systems",
    label: "Database Systems",
    primaryModules: ["CS2102", "CS3223"],
    electiveModules: ["CS4221", "CS4225"]
  },
  {
    id: "multimedia-information-retrieval",
    label: "Multimedia Information Retrieval",
    primaryModules: ["CS3245", "CS3246"],
    electiveModules: ["CS4242", "CS4347"]
  },
  {
    id: "networking-distributed-systems",
    label: "Networking and Distributed Systems",
    primaryModules: ["CS2105", "CS3204", "CS3237"],
    electiveModules: ["CS4222", "CS4226"]
  },
  {
    id: "parallel-computing",
    label: "Parallel Computing",
    primaryModules: ["CS2105", "CS3210"],
    electiveModules: ["CS4231", "CS4232"]
  },
  {
    id: "programming-languages",
    label: "Programming Languages",
    primaryModules: ["CS2104", "CS3211"],
    electiveModules: ["CS4212", "CS4215"]
  },
  {
    id: "software-engineering",
    label: "Software Engineering",
    primaryModules: ["CS3219", "CS3203"],
    electiveModules: ["CS4211", "CS4218"]
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
  const nonUeMappings = mergeModuleRequirementTags([
    ...csModuleRequirementTags,
    ...generatedCsModuleRequirementTags,
    ...getGeneratedCsModuleRequirementTags(modules)
  ]);

  return mergeModuleRequirementTags([
    ...nonUeMappings,
    ...getGeneratedCsUeModuleRequirementTags(modules, nonUeMappings)
  ]);
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
  cohort: "AY2025/26",
  version: 1,
  totalUnits: 160,
  sourceNote:
    "Milestone 1 representative subset for architecture demonstration. Verify against official NUS SoC curriculum before production use.",
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
