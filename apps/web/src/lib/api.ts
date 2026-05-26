import type {
  Module,
  Plan,
  PlanExport,
  RequirementSet,
  StudentProfile
} from "@the-cs-plan/shared";

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
  listPlans: () => request<Plan[]>("/api/plans"),
  createPlan: (plan: Plan) =>
    request<Plan>("/api/plans", { method: "POST", body: JSON.stringify(plan) }),
  updatePlan: (plan: Plan) =>
    request<Plan>(`/api/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(plan) }),
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
  exportPlan: (planId: string) => request<PlanExport>(`/api/plans/${planId}/export`),
  importPlan: (payload: PlanExport) =>
    request<Plan>("/api/plans/import", { method: "POST", body: JSON.stringify(payload) })
};
