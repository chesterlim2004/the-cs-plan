import { z } from "zod";

export const ProgrammeSchema = z.enum(["computer-science", "business-analytics"]);
export const CohortSchema = z.literal("AY2025/26");
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
  grade: ModuleGradeSchema.optional()
});

export const PlaceholderPlanItemSchema = z.object({
  id: z.string().optional(),
  type: z.literal("placeholder"),
  requirementId: z.string().min(1),
  label: z.string().min(1),
  units: z.number().int().positive()
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
  primaryPlanId: z.string().optional()
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

export const ModuleRequirementTagsSchema = z.object({
  programme: ProgrammeSchema,
  cohort: CohortSchema,
  moduleCode: z.string().trim().toUpperCase().min(2),
  tags: z.array(z.string()).default([])
});

export const RequirementRuleTypeSchema = z.enum([
  "module-list",
  "units-from-tags",
  "capped-units-from-tags",
  "placeholder-units",
  "combined-units",
  "structured-idcd",
  "structured-breadth-depth",
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
  dissertationTags: z.array(z.string()).optional()
});

export const RequirementSetSchema = z.object({
  programme: ProgrammeSchema,
  cohort: CohortSchema,
  version: z.number().int().positive(),
  totalUnits: z.number().int().positive(),
  sourceNote: z.string(),
  rules: z.array(RequirementRuleSchema)
});

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
export type PlanExport = z.infer<typeof PlanExportSchema>;

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
