import { z } from "zod";

export const programmeValues = [
  "computer-science",
  "business-analytics",
  "business-artificial-intelligence-systems",
  "computer-science-mathematics-double-major",
  "computer-science-mathematics-double-degree",
  "business-analytics-economics-double-degree"
] as const;

export const ProgrammeSchema = z.enum(programmeValues);
export const CohortSchema = z
  .string()
  .regex(/^AY\d{4}\/\d{2}$/, "Cohort must use the format AY2025/26")
  .refine((cohort) => {
    const startYear = Number(cohort.slice(2, 6));
    const endYear = Number(cohort.slice(7, 9));
    return (startYear + 1) % 100 === endYear;
  }, "Cohort must describe consecutive academic years");
export const SemesterKeySchema = z.enum([
  "IBLOC",
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
  "Y5S1",
  "Y5S2"
]);
export const StartingSemesterSchema = z.enum(["IBLOC", "Y1S1"]);
export const GraduationSemesterSchema = z.enum(["Y3S1", "Y3S2", "Y4S1", "Y4S2", "Y5S1", "Y5S2"]);

export const PlanItemStatusSchema = z.enum(["completed", "current", "planned"]);
export const ModuleGradeSchema = z.enum([
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "D+",
  "D",
  "F",
  "S",
  "U",
  "CS"
]);

export const ModulePlanItemSchema = z.object({
  id: z.string().optional(),
  type: z.literal("module"),
  moduleCode: z.string().trim().toUpperCase().min(2),
  units: z.number().int().positive(),
  status: PlanItemStatusSchema.default("planned"),
  grade: ModuleGradeSchema.optional(),
  isSu: z.boolean().default(false)
});

export const PlaceholderPlanItemSchema = z.object({
  id: z.string().optional(),
  type: z.literal("placeholder"),
  requirementId: z.string().min(1),
  label: z.string().min(1),
  units: z.number().int().positive(),
  grade: ModuleGradeSchema.optional(),
  isSu: z.boolean().default(false)
});

export const PlanItemSchema = z.discriminatedUnion("type", [
  ModulePlanItemSchema,
  PlaceholderPlanItemSchema
]);

export const SemesterPlanSchema = z.object({
  key: SemesterKeySchema,
  label: z.string().min(1),
  items: z.array(PlanItemSchema)
});

export const PlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).default("Primary Plan"),
  programme: ProgrammeSchema,
  cohort: CohortSchema,
  semesters: z.array(SemesterPlanSchema)
});

export const StudentProfileSchema = z.object({
  programme: ProgrammeSchema,
  cohort: CohortSchema,
  startingSemester: StartingSemesterSchema.default("Y1S1"),
  currentSemester: SemesterKeySchema.optional(),
  graduationSemester: GraduationSemesterSchema.default("Y4S2"),
  primaryPlanId: z.string().optional(),
  planOrder: z.array(z.string()).default([])
}).transform((profile) => {
  const semesterRange = getSemesterRange(profile.startingSemester, profile.graduationSemester);
  return {
    ...profile,
    currentSemester:
      profile.currentSemester && semesterRange.includes(profile.currentSemester)
        ? profile.currentSemester
        : profile.startingSemester
  };
});

export const ModuleSchema = z.object({
  acadYear: z.string(),
  moduleCode: z.string(),
  title: z.string(),
  units: z.number().int().positive(),
  department: z.string().optional(),
  faculty: z.string().optional(),
  description: z.string().optional(),
  prerequisite: z.string().optional(),
  prereqTree: z.unknown().optional()
});

export type SuEligibility = "eligible" | "ineligible" | "unknown";

const alwaysSuEligibleCourseCodes = new Set([
  "CS2101",
  "ENV2302",
  "ES2002",
  "ES2007D",
  "ES2531",
  "ES2660",
  "IS2101",
  "ST2334"
]);

export function getSuEligibility(
  module: Pick<
    z.infer<typeof ModuleSchema>,
    "moduleCode" | "title" | "units" | "department" | "faculty" | "prerequisite" | "prereqTree"
  >,
  cohort?: string
): SuEligibility {
  const moduleCode = module.moduleCode.trim().toUpperCase();
  const organization = `${module.department ?? ""} ${module.faculty ?? ""}`;
  const isLanguageCourse =
    /Centre for Language Studies/i.test(organization)
    || /Yale-NUS College/i.test(organization) && /language/i.test(module.title);

  if (isLanguageCourse) {
    return "eligible";
  }
  if (module.units <= 0) {
    return "ineligible";
  }
  if (
    /^U(?:WC|QF)2101/.test(moduleCode)
    || (
      /Yong Siew Toh|Conservatory of Music/i.test(organization)
      && /Major Study/i.test(module.title)
      && getModuleLevel(moduleCode) === 1
    )
  ) {
    return "ineligible";
  }
  if (
    alwaysSuEligibleCourseCodes.has(moduleCode)
    || moduleCode.startsWith("UTW2001")
    || (
      (moduleCode === "MA2001" || moduleCode === "MA2002")
      && isCohortAtLeast(cohort, 2016)
    )
    || (moduleCode === "MA2301" && isCohortAtLeast(cohort, 2021))
  ) {
    return "eligible";
  }

  const level = getModuleLevel(moduleCode);
  if (level === 1) {
    return "eligible";
  }
  if (level === 2) {
    return hasNusCoursePrerequisite(module.prerequisite, module.prereqTree)
      ? "ineligible"
      : "eligible";
  }
  if (level !== null && level >= 3) {
    return "ineligible";
  }
  return "unknown";
}

function getModuleLevel(moduleCode: string): number | null {
  const match = moduleCode.match(/^[A-Z]+(\d)/);
  return match?.[1] ? Number(match[1]) : null;
}

function hasNusCoursePrerequisite(prerequisite: string | undefined, prereqTree: unknown): boolean {
  const prerequisiteData = [
    prerequisite ?? "",
    prereqTree === undefined ? "" : JSON.stringify(prereqTree)
  ].join(" ");
  return /\b[A-Z]{1,4}\d{4}[A-Z]*\b/i.test(prerequisiteData);
}

function isCohortAtLeast(cohort: string | undefined, minimumStartYear: number): boolean {
  const match = cohort?.match(/^AY(\d{2}|\d{4})\/\d{2}$/);
  const yearText = match?.[1];
  if (!yearText) {
    return true;
  }
  const startYear = Number(yearText);
  return (yearText.length === 2 ? 2000 + startYear : startYear) >= minimumStartYear;
}

export const ModuleRequirementTagsSchema = z.object({
  programme: ProgrammeSchema,
  cohort: CohortSchema,
  moduleCode: z.string().trim().toUpperCase().min(2),
  tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]*$/)).default([])
});

export const RequirementRuleTypeSchema = z.enum([
  "module-list",
  "module-choice",
  "units-from-tags",
  "capped-units-from-tags",
  "placeholder-units",
  "combined-units",
  "structured-idcd",
  "structured-breadth-depth",
  "structured-programme-electives",
  "structured-industry-experience",
  "structured-ddp-honours-pathway",
  "residual-units"
]);

export const FocusAreaSchema = z.object({
  id: z.string(),
  label: z.string(),
  primaryModules: z.array(z.string()),
  electiveModules: z.array(z.string())
});

export const RequirementRuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: RequirementRuleTypeSchema,
  requiredUnits: z.number().int().positive().optional(),
  requiredModules: z.array(z.string()).optional(),
  moduleOptions: z.array(z.array(z.string())).optional(),
  acceptedTags: z.array(z.string()).optional(),
  idTags: z.array(z.string()).optional(),
  cdTags: z.array(z.string()).optional(),
  requiredIdMinCourses: z.number().int().nonnegative().optional(),
  allowedCdMaxCourses: z.number().int().nonnegative().optional(),
  tagCaps: z.array(z.object({
    tag: z.string(),
    maxUnits: z.number().int().positive()
  })).optional(),
  acceptedPlaceholders: z.array(z.string()).optional(),
  focusAreas: z.array(FocusAreaSchema).optional(),
  requiredFocusAreaPrimaryCount: z.number().int().positive().optional(),
  requiredFocusAreaLevel4000PrimaryCount: z.number().int().positive().optional(),
  requiredLevel4000Units: z.number().int().positive().optional(),
  requiredIndustryMinUnits: z.number().int().nonnegative().optional(),
  requiredIndustryMaxUnits: z.number().int().positive().optional(),
  allowedNonIndustryPrefixes: z.array(z.string()).optional(),
  maxNonIndustryCpUnits: z.number().int().nonnegative().optional(),
  industryTags: z.array(z.string()).optional(),
  dissertationTags: z.array(z.string()).optional(),
  requiredMinCourses: z.number().int().positive().optional(),
  requiredLevel4000MinCourses: z.number().int().nonnegative().optional(),
  requiredPrefixMinCourses: z.number().int().nonnegative().optional(),
  requiredPrefixes: z.array(z.string()).optional(),
  internshipFoundationTags: z.array(z.string()).optional(),
  secondInternshipTags: z.array(z.string()).optional(),
  supplementaryTags: z.array(z.string()).optional(),
  integratedThesisTags: z.array(z.string()).optional(),
  economicsElectiveTags: z.array(z.string()).optional(),
  economicsLevel4000Tags: z.array(z.string()).optional(),
  requiredFoundationUnits: z.number().int().positive().optional(),
  requiredCompanionUnits: z.number().int().positive().optional(),
  integratedThesisUnits: z.number().int().positive().optional(),
  integratedEconomicsUnits: z.number().int().positive().optional(),
  integratedEconomicsLevel4000Units: z.number().int().positive().optional(),
  internshipEconomicsUnits: z.number().int().positive().optional(),
  internshipEconomicsLevel4000Units: z.number().int().positive().optional(),
  internshipPathwayRequiredUnits: z.number().int().positive().optional(),
  tagUnitOverrides: z.array(z.object({
    tag: z.string(),
    units: z.number().int().positive()
  })).optional(),
  advisory: z.string().optional()
});

export const RequirementSetSchema = z.object({
  programme: ProgrammeSchema,
  cohort: CohortSchema,
  version: z.number().int().positive(),
  totalUnits: z.number().int().positive(),
  sourceNote: z.string(),
  rules: z.array(RequirementRuleSchema)
});

export const AdminModuleTagChangeSchema = z.object({
  moduleCode: z.string().trim().toUpperCase().min(2),
  tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]*$/))
    .transform((tags) => Array.from(new Set(tags))),
  deleteMapping: z.literal(true).optional()
}).refine(
  (change) => !change.deleteMapping || change.tags.length === 0,
  { message: "Deleted module mappings cannot contain tags", path: ["tags"] }
);

export const AdminCurriculumDraftSchema = z.object({
  programme: ProgrammeSchema,
  cohort: CohortSchema,
  baseVersion: z.number().int().nonnegative(),
  totalUnits: z.number().int().positive(),
  sourceNote: z.string().trim().min(1),
  rules: z.array(RequirementRuleSchema).min(1),
  tagChanges: z.array(AdminModuleTagChangeSchema).default([])
});

export const AdminCloneCurriculumSchema = z.object({
  sourceProgramme: ProgrammeSchema,
  sourceCohort: CohortSchema,
  targetProgramme: ProgrammeSchema,
  targetCohort: CohortSchema
}).refine(
  (input) => input.sourceProgramme !== input.targetProgramme || input.sourceCohort !== input.targetCohort,
  { message: "Source and target curricula must be different", path: ["targetCohort"] }
);

export const PlanExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  profile: StudentProfileSchema,
  plan: PlanSchema
});

export type Programme = z.infer<typeof ProgrammeSchema>;
export type Cohort = z.infer<typeof CohortSchema>;
export type SemesterKey = z.infer<typeof SemesterKeySchema>;
export type StartingSemester = z.infer<typeof StartingSemesterSchema>;
export type GraduationSemester = z.infer<typeof GraduationSemesterSchema>;
export type PlanItemStatus = z.infer<typeof PlanItemStatusSchema>;
export type ModuleGrade = z.infer<typeof ModuleGradeSchema>;
export type ModulePlanItem = z.infer<typeof ModulePlanItemSchema>;
export type PlaceholderPlanItem = z.infer<typeof PlaceholderPlanItemSchema>;
export type PlanItem = z.infer<typeof PlanItemSchema>;
export type SemesterPlan = z.infer<typeof SemesterPlanSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type StudentProfile = z.infer<typeof StudentProfileSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type ModuleRequirementTags = z.infer<typeof ModuleRequirementTagsSchema>;
export type RequirementRule = z.infer<typeof RequirementRuleSchema>;
export type RequirementSet = z.infer<typeof RequirementSetSchema>;
export type AdminModuleTagChange = z.infer<typeof AdminModuleTagChangeSchema>;
export type AdminCurriculumDraft = z.infer<typeof AdminCurriculumDraftSchema>;
export type AdminCloneCurriculum = z.infer<typeof AdminCloneCurriculumSchema>;
export type PlanExport = z.infer<typeof PlanExportSchema>;

export const programmeLabels: Record<Programme, string> = {
  "computer-science": "Computer Science",
  "business-analytics": "Business Analytics",
  "business-artificial-intelligence-systems": "Business Artificial Intelligence Systems",
  "computer-science-mathematics-double-major": "Computer Science and Mathematics Double Major",
  "computer-science-mathematics-double-degree": "Computer Science and Mathematics Double Degree",
  "business-analytics-economics-double-degree": "Business Analytics and Economics Double Degree"
};

export const semesterLabels: Record<SemesterKey, string> = {
  IBLOC: "iBLOC",
  Y1S1: "Year 1 Semester 1",
  Y1S2: "Year 1 Semester 2",
  Y2S1: "Year 2 Semester 1",
  Y2S2: "Year 2 Semester 2",
  Y3S1: "Year 3 Semester 1",
  Y3S2: "Year 3 Semester 2",
  Y4S1: "Year 4 Semester 1",
  Y4S2: "Year 4 Semester 2",
  Y5S1: "Year 5 Semester 1",
  Y5S2: "Year 5 Semester 2"
};

export const semesterOrder = Object.keys(semesterLabels) as SemesterKey[];
export const startingSemesterOptions = StartingSemesterSchema.options;
export const graduationSemesterOptions = GraduationSemesterSchema.options;
export const moduleGradeOptions = ModuleGradeSchema.options;

export const gradePoints: Record<Exclude<ModuleGrade, "S" | "U" | "CS">, number> = {
  "A+": 5,
  A: 5,
  "A-": 4.5,
  "B+": 4,
  B: 3.5,
  "B-": 3,
  "C+": 2.5,
  C: 2,
  "D+": 1.5,
  D: 1,
  F: 0
};

export function createSemestersUntil(graduationSemester: SemesterKey): SemesterPlan[] {
  return createSemestersForRange("Y1S1", graduationSemester);
}

export function getSemesterRange(
  startingSemester: SemesterKey,
  graduationSemester: SemesterKey
): SemesterKey[] {
  const startIndex = semesterOrder.indexOf(startingSemester);
  const endIndex = semesterOrder.indexOf(graduationSemester);
  const normalizedStartIndex = startIndex >= 0 ? startIndex : 0;
  const normalizedEndIndex = endIndex >= normalizedStartIndex ? endIndex : normalizedStartIndex;

  return semesterOrder.slice(normalizedStartIndex, normalizedEndIndex + 1);
}

export function createSemestersForRange(
  startingSemester: SemesterKey,
  graduationSemester: SemesterKey
): SemesterPlan[] {
  return getSemesterRange(startingSemester, graduationSemester).map((key) => ({
    key,
    label: semesterLabels[key],
    items: []
  }));
}
