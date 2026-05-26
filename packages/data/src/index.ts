import type { Module, RequirementSet } from "@the-cs-plan/shared";

export const seededModules: Module[] = [
  {
    acadYear: "2025-2026",
    moduleCode: "CS1101S",
    title: "Programming Methodology",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Introduction to programming and computational problem solving.",
    requirementTags: ["cs-foundation"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS1231S",
    title: "Discrete Structures",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Mathematical foundations for computing.",
    requirementTags: ["cs-foundation"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2030S",
    title: "Programming Methodology II",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Object-oriented and functional programming techniques.",
    prerequisite: "CS1101S or equivalent programming experience.",
    requirementTags: ["cs-foundation"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CS2040S",
    title: "Data Structures and Algorithms",
    units: 4,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Design and analysis of data structures and algorithms.",
    prerequisite: "CS1101S or equivalent.",
    requirementTags: ["cs-foundation"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "MA1521",
    title: "Calculus for Computing",
    units: 4,
    department: "Mathematics",
    faculty: "Faculty of Science",
    description: "Calculus topics for computing students.",
    requirementTags: ["cs-foundation"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "IS1108",
    title: "Digital Ethics and Data Privacy",
    units: 4,
    department: "Information Systems and Analytics",
    faculty: "School of Computing",
    description: "Ethics, privacy, and responsibility in digital systems.",
    requirementTags: ["common-curriculum"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "GEA1000",
    title: "Quantitative Reasoning with Data",
    units: 4,
    department: "General Education",
    faculty: "NUS",
    description: "Quantitative reasoning and data literacy.",
    requirementTags: ["common-curriculum"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "ES2660",
    title: "Communicating in the Information Age",
    units: 4,
    department: "Centre for English Language Communication",
    faculty: "NUS",
    description: "Communication skills for information-age contexts.",
    requirementTags: ["common-curriculum"]
  },
  {
    acadYear: "2025-2026",
    moduleCode: "CP3200",
    title: "Internship",
    units: 6,
    department: "Computer Science",
    faculty: "School of Computing",
    description: "Industry experience module.",
    requirementTags: ["industry-experience"]
  }
];

export const csRequirementSet: RequirementSet = {
  programme: "computer-science",
  cohort: "AY2025/26",
  version: 1,
  sourceNote:
    "Milestone 1 representative subset for architecture demonstration. Verify against official NUS SoC curriculum before production use.",
  rules: [
    {
      id: "cs-foundation",
      label: "CS Foundation/Core Modules",
      type: "module-list",
      requiredModules: ["CS1101S", "CS1231S", "CS2030S", "CS2040S", "MA1521"]
    },
    {
      id: "common-curriculum",
      label: "University/Common Curriculum",
      type: "units-from-tags",
      requiredUnits: 12,
      acceptedTags: ["common-curriculum"]
    },
    {
      id: "idcd",
      label: "ID/CD Requirement",
      type: "placeholder-units",
      requiredUnits: 4,
      acceptedPlaceholders: ["idcd"]
    },
    {
      id: "ue",
      label: "Unrestricted Electives",
      type: "placeholder-units",
      requiredUnits: 8,
      acceptedPlaceholders: ["ue"]
    }
  ]
};
