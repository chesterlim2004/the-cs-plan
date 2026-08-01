import type {
  AdminCloneCurriculum,
  AdminCurriculumDraft,
  Module,
  ModuleRequirementTags,
  Plan,
  PlanExport,
  RequirementSet,
  StudentProfile
} from "@the-cs-plan/shared";

export interface AdminCurriculumCatalogItem {
  programme: AdminCurriculumDraft["programme"];
  cohort: string;
  latestVersion: number;
  versionCount: number;
  totalUnits: number;
  sourceNote: string;
  redirectLink?: string;
  ruleCount: number;
  tagCount: number;
  updatedAt: string;
}

export interface AdminValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    ruleCount: number;
    mappedModuleCount: number;
    stagedTagChangeCount: number;
    samplePlansEvaluated: number;
  };
  samplePlans: Array<{
    sample: number;
    fulfilledRules: number;
    totalRules: number;
    completedUnits: number;
    warningCount: number;
  }>;
}

export interface AdminClonePreview {
  source: {
    programme: AdminCloneCurriculum["sourceProgramme"];
    cohort: string;
    version: number;
    totalUnits: number;
    ruleCount: number;
    tagCount: number;
    sourceNote: string;
    redirectLink?: string;
  };
  target: {
    programme: AdminCloneCurriculum["targetProgramme"];
    cohort: string;
    version: number;
  };
  canClone: boolean;
  conflicts: string[];
  warnings: string[];
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    role: "student" | "admin";
  };
  profile: (StudentProfile & { primaryPlanId?: string }) | null;
}

export const api = {
  apiUrl,
  loginUrl: `${apiUrl}/api/auth/google`,
  me: () => request<MeResponse>("/api/me"),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  getProfile: () => request<StudentProfile | null>("/api/profile"),
  saveProfile: (profile: StudentProfile) =>
    request<StudentProfile & { primaryPlanId?: string }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(profile)
    }),
  searchModules: (query: string) =>
    request<Module[]>(`/api/modules?query=${encodeURIComponent(query)}`),
  getModule: (moduleCode: string) =>
    request<Module>(`/api/modules/${encodeURIComponent(moduleCode)}`),
  getModuleRequirementTags: (programme: string, cohort: string) =>
    request<ModuleRequirementTags[]>(
      `/api/modules/tags/${encodeURIComponent(programme)}/${encodeURIComponent(cohort)}`
    ),
  listPlans: () => request<Plan[]>("/api/plans"),
  createPlan: (plan: Plan) =>
    request<Plan>("/api/plans", { method: "POST", body: JSON.stringify(plan) }),
  updatePlan: (plan: Plan) =>
    request<Plan>(`/api/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(plan) }),
  deletePlan: (planId: string) => request<void>(`/api/plans/${planId}`, { method: "DELETE" }),
  evaluatePlan: (planId: string) =>
    request<{
      requirementSetVersion: number;
      totalCompletedUnits: number;
      totalRequiredUnits: number;
      requirements: Array<{
        id: string;
        label: string;
        completedUnits: number;
        requiredUnits: number;
        percentage: number;
        status: "fulfilled" | "partial" | "missing";
        contributors: string[];
        missing: string[];
        warnings: string[];
      }>;
      warnings: string[];
    }>(`/api/plans/${planId}/evaluate`, { method: "POST" }),
  getRequirements: (programme: string, cohort: string) =>
    request<RequirementSet>(
      `/api/requirements/${encodeURIComponent(programme)}/${encodeURIComponent(cohort)}`
    ),
  listRequirementSets: () =>
    request<{
      curricula: Array<{ programme: RequirementSet["programme"]; cohort: RequirementSet["cohort"] }>;
    }>("/api/requirements"),
  exportPlan: (planId: string) => request<PlanExport>(`/api/plans/${planId}/export`),
  importPlan: (payload: PlanExport) =>
    request<Plan>("/api/plans/import", { method: "POST", body: JSON.stringify(payload) }),
  adminListCurricula: () =>
    request<{ curricula: AdminCurriculumCatalogItem[] }>("/api/admin/catalog"),
  adminGetCurriculum: (programme: string, cohort: string) =>
    request<RequirementSet>(
      `/api/admin/curricula/${encodeURIComponent(programme)}/${encodeURIComponent(cohort)}`
    ),
  adminSearchModuleTags: (programme: string, cohort: string, query: string, page: number, tag: string) =>
    request<{
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      rows: Array<{
        moduleCode: string;
        title: string;
        acadYear?: string;
        tags: string[];
        mapped: boolean;
      }>;
    }>(
      `/api/admin/module-tags/${encodeURIComponent(programme)}/${encodeURIComponent(cohort)}?query=${encodeURIComponent(query)}&page=${page}&tag=${encodeURIComponent(tag)}`
    ),
  adminListCurriculumModuleTags: (programme: string, cohort: string) =>
    request<{
      tags: Array<{ tag: string; moduleCodes: string[] }>;
    }>(
      `/api/admin/module-tags/${encodeURIComponent(programme)}/${encodeURIComponent(cohort)}/available`
    ),
  adminValidateCurriculum: (draft: AdminCurriculumDraft) =>
    request<AdminValidationResult>("/api/admin/validate", {
      method: "POST",
      body: JSON.stringify(draft)
    }),
  adminPublishCurriculum: (draft: AdminCurriculumDraft) =>
    request<{ requirementSet: RequirementSet; validation: AdminValidationResult }>("/api/admin/publish", {
      method: "POST",
      body: JSON.stringify(draft)
    }),
  adminPreviewClone: (input: AdminCloneCurriculum) =>
    request<AdminClonePreview>("/api/admin/clone/preview", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  adminCloneCurriculum: (input: AdminCloneCurriculum) =>
    request<{ requirementSet: RequirementSet; copiedTagCount: number }>("/api/admin/clone", {
      method: "POST",
      body: JSON.stringify(input)
    })
};
