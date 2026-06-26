import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import {
  gradePoints,
  moduleGradeOptions,
  semesterLabels,
  type ModuleGrade,
  type Plan,
  type SemesterPlan
} from "@the-cs-plan/shared";
import { Card, Select } from "../components/ui";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type GpaResult = {
  gpa: number | null;
  gradedUnits: number;
  gradedModules: number;
};


type GpaDropdownGrade = Exclude<ModuleGrade, "S" | "U">;
type GpaMode = "pre-su" | "post-su";
type SuExpiryPolicy = {
  deadlineSemester: SemesterPlan["key"];
  requiredUses: number;
  cohortLabel: string;
  windowLabel: string;
};
type SuLaterWindowPolicy = {
  startSemester: SemesterPlan["key"];
  maxUses: number;
  cohortLabel: string;
  windowLabel: string;
};
type SuExpiryDismissalRecord = {
  dismissedAtSuUsed: number | null;
  lastSeenSuUsed: number;
};

const gpaGradeOptions = moduleGradeOptions.filter(
  (grade): grade is GpaDropdownGrade => grade !== "S" && grade !== "U"
);

function getOrderedPlans(plans: Plan[], planOrder: string[] | undefined) {
  const orderIndex = new Map((planOrder ?? []).map((planId, index) => [planId, index]));
  return [...plans].sort((first, second) => {
    const firstIndex = first.id ? orderIndex.get(first.id) : undefined;
    const secondIndex = second.id ? orderIndex.get(second.id) : undefined;

    if (firstIndex !== undefined && secondIndex !== undefined) {
      return firstIndex - secondIndex;
    }

    if (firstIndex !== undefined) {
      return -1;
    }

    if (secondIndex !== undefined) {
      return 1;
    }

    return 0;
  });
}

function formatGradeOptionLabel(grade: GpaDropdownGrade) {
  if (grade === "CS") {
    return `${grade} : -`;
  }

  return `${grade} : ${gradePoints[grade].toFixed(2)}`;
}

function formatGpa(result: GpaResult) {
  return result.gpa === null ? "-" : result.gpa.toFixed(2);
}

function isSuItem(item: SemesterPlan["items"][number]) {
  return item.isSu || item.grade === "S" || item.grade === "U";
}

function countSuItems(semesters: SemesterPlan[]) {
  return semesters.reduce(
    (count, semester) => count + semester.items.filter((item) => isSuItem(item)).length,
    0
  );
}

function getCohortStartYear(cohort: string | undefined) {
  const match = cohort?.match(/^AY(\d{2}|\d{4})\/\d{2}$/);
  const yearText = match?.[1];
  if (!yearText) {
    return null;
  }

  const year = Number(yearText);
  return yearText.length === 2 ? 2000 + year : year;
}

function getSuExpiryPolicy(cohort: string | undefined): SuExpiryPolicy {
  const cohortStartYear = getCohortStartYear(cohort);

  if (cohortStartYear !== null && cohortStartYear < 2025) {
    return {
      deadlineSemester: "Y1S2",
      requiredUses: 5,
      cohortLabel: "AY2024/25 and earlier cohorts",
      windowLabel: "first year"
    };
  }

  return {
    deadlineSemester: "Y2S2",
    requiredUses: 5,
    cohortLabel: "AY2025/26 and later cohorts",
    windowLabel: "first two years"
  };
}

function getSuLaterWindowPolicy(cohort: string | undefined): SuLaterWindowPolicy {
  const cohortStartYear = getCohortStartYear(cohort);

  if (cohortStartYear !== null && cohortStartYear < 2025) {
    return {
      startSemester: "Y2S1",
      maxUses: 3,
      cohortLabel: "AY2024/25 and earlier cohorts",
      windowLabel: "from Y2S1 onwards"
    };
  }

  return {
    startSemester: "Y3S1",
    maxUses: 3,
    cohortLabel: "AY2025/26 and later cohorts",
    windowLabel: "from Y3S1 onwards"
  };
}

function getSuExpiryWarning(plan: Plan, cohort: string | undefined) {
  const policy = getSuExpiryPolicy(cohort);
  const deadlineIndex = plan.semesters.findIndex((semester) => semester.key === policy.deadlineSemester);
  if (deadlineIndex === -1) {
    return null;
  }

  const suUsedBeforeExpiry = countSuItems(plan.semesters.slice(0, deadlineIndex + 1));
  if (suUsedBeforeExpiry >= policy.requiredUses) {
    return null;
  }

  return `${policy.cohortLabel} must use at least ${policy.requiredUses} S/Us by the end of ${policy.deadlineSemester}. This plan has only used ${suUsedBeforeExpiry} out of ${policy.requiredUses} S/Us in the ${policy.windowLabel}, so unused early-window S/Us will expire.`;
}

function getSuLaterWindowWarning(plan: Plan, cohort: string | undefined) {
  const policy = getSuLaterWindowPolicy(cohort);
  const startIndex = plan.semesters.findIndex((semester) => semester.key === policy.startSemester);
  if (startIndex === -1) {
    return null;
  }

  const suUsedInLaterWindow = countSuItems(plan.semesters.slice(startIndex));
  if (suUsedInLaterWindow <= policy.maxUses) {
    return null;
  }

  return `${policy.cohortLabel} can use a maximum of ${policy.maxUses} S/Us ${policy.windowLabel}. This plan uses ${suUsedInLaterWindow} out of ${policy.maxUses} possible S/Us in that later window, so remove ${suUsedInLaterWindow - policy.maxUses} ${suUsedInLaterWindow - policy.maxUses === 1 ? "S/U" : "S/Us"} from ${policy.startSemester} onwards.`;
}

function isCountedGrade(grade: ModuleGrade | undefined): grade is Exclude<ModuleGrade, "S" | "U" | "CS"> {
  return Boolean(grade && grade !== "S" && grade !== "U" && grade !== "CS");
}

function calculateGpaForSemesters(semesters: SemesterPlan[], mode: GpaMode): GpaResult {
  let totalPoints = 0;
  let gradedUnits = 0;
  let gradedModules = 0;

  for (const semester of semesters) {
    for (const item of semester.items) {
      if (
        !isCountedGrade(item.grade) ||
        (mode === "post-su" && isSuItem(item))
      ) {
        continue;
      }

      totalPoints += gradePoints[item.grade] * item.units;
      gradedUnits += item.units;
      gradedModules += 1;
    }
  }

  return {
    gpa: gradedUnits > 0 ? totalPoints / gradedUnits : null,
    gradedUnits,
    gradedModules
  };
}

function calculateGpa(semester: SemesterPlan): GpaResult {
  return calculateGpaForSemesters([semester], "post-su");
}

function getCompletedSemestersBeforeCurrent(plan: Plan, currentSemester: SemesterPlan["key"] | undefined) {
  const currentIndex = plan.semesters.findIndex((semester) => semester.key === currentSemester);
  return currentIndex > 0 ? plan.semesters.slice(0, currentIndex) : [];
}

function getSuExpiryDismissalCacheKey(planId: string | undefined) {
  return planId ? `the-cs-plan:dismissed-su-expiry:${planId}` : null;
}

function readSuExpiryDismissal(planId: string | undefined): SuExpiryDismissalRecord | null {
  const cacheKey = getSuExpiryDismissalCacheKey(planId);
  if (!cacheKey) {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(cacheKey);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as Partial<SuExpiryDismissalRecord>;
    if (
      (typeof parsed.dismissedAtSuUsed === "number" || parsed.dismissedAtSuUsed === null) &&
      typeof parsed.lastSeenSuUsed === "number"
    ) {
      return {
        dismissedAtSuUsed: parsed.dismissedAtSuUsed,
        lastSeenSuUsed: parsed.lastSeenSuUsed
      };
    }
  } catch {
    return null;
  }

  return null;
}

function writeSuExpiryDismissal(planId: string | undefined, record: SuExpiryDismissalRecord) {
  const cacheKey = getSuExpiryDismissalCacheKey(planId);
  if (!cacheKey) {
    return;
  }

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(record));
  } catch {
    return;
  }
}

export function GpaPage() {
  const queryClient = useQueryClient();
  const [isSuWarningPanelOpen, setIsSuWarningPanelOpen] = useState(false);
  const [isSuExpiryWarningDismissed, setIsSuExpiryWarningDismissed] = useState(false);
  const suWarningPanelRef = useRef<HTMLDivElement | null>(null);
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: api.listPlans });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const plans = plansQuery.data ?? [];
  const orderedPlans = getOrderedPlans(plans, profileQuery.data?.planOrder);
  const plan = orderedPlans.find((candidate) => candidate.id === profileQuery.data?.primaryPlanId) ?? orderedPlans[0];
  const primaryPlanMutation = useMutation({
    mutationFn: api.saveProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(["profile"], profile);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });
  const updateMutation = useMutation({
    mutationFn: api.updatePlan,
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData<Plan[]>(["plans"], (plans) =>
        plans?.map((candidate) => (candidate.id === updatedPlan.id ? updatedPlan : candidate))
      );
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    }
  });
  const suUsed = plan ? countSuItems(plan.semesters) : 0;
  const suLimitWarning = suUsed > 8
    ? `This plan uses ${suUsed} out of 8 possible S/Us. The maximum S/U count is 8, so remove ${suUsed - 8} ${suUsed - 8 === 1 ? "S/U" : "S/Us"} to stay within the limit.`
    : null;
  const suLaterWindowWarning = plan ? getSuLaterWindowWarning(plan, profileQuery.data?.cohort) : null;
  const redSuWarnings = [suLimitWarning, suLaterWindowWarning].filter((warning): warning is string => Boolean(warning));
  const suExpiryWarning = plan ? getSuExpiryWarning(plan, profileQuery.data?.cohort) : null;
  const visibleSuExpiryWarning = suExpiryWarning && !isSuExpiryWarningDismissed ? suExpiryWarning : null;
  const hasSuWarnings = Boolean(redSuWarnings.length || visibleSuExpiryWarning);
  const hasRedSuWarning = redSuWarnings.length > 0;

  useEffect(() => {
    if (!plan?.id) {
      setIsSuExpiryWarningDismissed(false);
      return;
    }

    if (!suExpiryWarning) {
      writeSuExpiryDismissal(plan.id, {
        dismissedAtSuUsed: null,
        lastSeenSuUsed: suUsed
      });
      setIsSuExpiryWarningDismissed(false);
      return;
    }

    const dismissal = readSuExpiryDismissal(plan.id);
    if (dismissal?.lastSeenSuUsed === suUsed) {
      setIsSuExpiryWarningDismissed(dismissal.dismissedAtSuUsed === suUsed);
      return;
    }

    writeSuExpiryDismissal(plan.id, {
      dismissedAtSuUsed: null,
      lastSeenSuUsed: suUsed
    });
    setIsSuExpiryWarningDismissed(false);
  }, [plan?.id, suExpiryWarning, suUsed]);

  useEffect(() => {
    if (!isSuWarningPanelOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!suWarningPanelRef.current?.contains(event.target as Node)) {
        setIsSuWarningPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isSuWarningPanelOpen]);

  if (plansQuery.isLoading || profileQuery.isLoading) {
    return <div className="p-5 text-sm text-muted">Loading GPA tracker...</div>;
  }

  if (!plan) {
    return <div className="p-5 text-sm text-muted">No plan found. Add modules in the planner first.</div>;
  }

  const currentSemester = profileQuery.data?.currentSemester ?? profileQuery.data?.startingSemester;
  const completedSemesters = getCompletedSemestersBeforeCurrent(plan, currentSemester);
  const currentPreSu = calculateGpaForSemesters(completedSemesters, "pre-su");
  const currentPostSu = calculateGpaForSemesters(completedSemesters, "post-su");
  const entirePreSu = calculateGpaForSemesters(plan.semesters, "pre-su");
  const entirePostSu = calculateGpaForSemesters(plan.semesters, "post-su");
  const currentSemesterLabel = currentSemester === "IBLOC" ? semesterLabels[currentSemester] : currentSemester;

  function selectPlan(planId: string) {
    if (!planId || !profileQuery.data || profileQuery.data.primaryPlanId === planId) {
      return;
    }

    primaryPlanMutation.mutate({ ...profileQuery.data, primaryPlanId: planId });
  }

  function updateGrade(semesterKey: SemesterPlan["key"], itemIndex: number, grade: string) {
    const updatedPlan = structuredClone(plan!);
    const semester = updatedPlan.semesters.find((candidate) => candidate.key === semesterKey);
    const item = semester?.items[itemIndex];
    if (!item) {
      return;
    }

    if (grade) {
      item.grade = grade as ModuleGrade;
    } else {
      delete item.grade;
    }

    queryClient.setQueryData<Plan[]>(["plans"], (plans) =>
      plans?.map((candidate) => (candidate.id === updatedPlan.id ? updatedPlan : candidate))
    );
    updateMutation.mutate(updatedPlan);
  }

  function updateSu(semesterKey: SemesterPlan["key"], itemIndex: number, isSu: boolean) {
    const updatedPlan = structuredClone(plan!);
    const semester = updatedPlan.semesters.find((candidate) => candidate.key === semesterKey);
    const item = semester?.items[itemIndex];
    if (!item) {
      return;
    }

    item.isSu = isSu;
    if (!isSu && (item.grade === "S" || item.grade === "U")) {
      delete item.grade;
    }

    queryClient.setQueryData<Plan[]>(["plans"], (plans) =>
      plans?.map((candidate) => (candidate.id === updatedPlan.id ? updatedPlan : candidate))
    );
    updateMutation.mutate(updatedPlan);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">GPA Tracker</h1>
            <div className="flex h-8 items-center gap-2 text-xs text-muted">
              {updateMutation.isPending ? (
                <>
                  <LoaderCircle className="animate-spin" size={14} />
                  Saving grades
                </>
              ) : updateMutation.isSuccess ? (
                <>
                  <Check size={14} />
                  Grades saved
                </>
              ) : updateMutation.isError ? (
                <span className="text-red-300">Could not save grade</span>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-sm text-muted">
            Assign grades to modules in your plan. Checked S/U modules and CS grades do not affect GPA.
          </p>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <div className="relative">
            <Select
              aria-label="Select plan"
              className="h-11 max-w-[18rem] appearance-none rounded-md border border-line bg-panel px-4 pr-10 text-base font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-white/5"
              value={plan.id ?? ""}
              onChange={(event) => selectPlan(event.target.value)}
              disabled={primaryPlanMutation.isPending}
            >
              {orderedPlans.map((candidate) => (
                <option key={candidate.id ?? candidate.name} value={candidate.id ?? ""}>
                  {candidate.name}
                </option>
              ))}
            </Select>
            <ChevronDown
              size={17}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
          <div ref={suWarningPanelRef} className="relative">
            <button
              type="button"
              className={cn(
                "rounded-md border px-5 py-3 text-base font-semibold transition",
                hasRedSuWarning
                  ? "border-red-400/80 bg-red-500/10 text-red-100 shadow-[0_0_0_1px_rgba(248,113,113,0.35)] hover:bg-red-400/15"
                  : visibleSuExpiryWarning
                    ? "border-amber-300/80 bg-amber-400/10 text-amber-100 shadow-[0_0_0_1px_rgba(252,211,77,0.35)] hover:bg-amber-300/15"
                    : "border-line bg-panel text-zinc-100 hover:border-zinc-500 hover:bg-white/5"
              )}
              onClick={() => setIsSuWarningPanelOpen((current) => !current)}
              aria-label="Show S/U policy warnings"
              aria-expanded={isSuWarningPanelOpen}
            >
              S/Us used: {suUsed} / 8
            </button>
            {isSuWarningPanelOpen ? (
              <Card
                className={cn(
                  "absolute right-0 top-14 z-20 w-96 p-4 text-left shadow-xl shadow-black/30",
                  hasRedSuWarning ? "border-red-500/30" : visibleSuExpiryWarning ? "border-amber-500/30" : "border-line"
                )}
              >
                <h2
                  className={cn(
                    "mb-2 flex items-center gap-2 text-sm font-semibold",
                    hasRedSuWarning ? "text-red-300" : visibleSuExpiryWarning ? "text-amber-300" : "text-zinc-100"
                  )}
                >
                  <AlertTriangle size={16} /> S/U Policy Warnings
                </h2>
                <div className="max-h-[28rem] overflow-y-auto text-xs leading-5">
                  {redSuWarnings.map((warning, index) => (
                    <div
                      key={warning}
                      className={cn(
                        "min-w-0 rounded-md py-2 pl-2 pr-2 text-red-100/80",
                        index > 0 && "border-t border-red-200/10"
                      )}
                    >
                      <p className="whitespace-normal break-words">{warning}</p>
                    </div>
                  ))}
                  {visibleSuExpiryWarning ? (
                    <div
                      className={cn(
                        "group relative min-w-0 rounded-md py-2 pl-2 pr-10 text-amber-100/80 transition duration-150 hover:-translate-y-0.5 hover:bg-amber-300/5 hover:ring-1 hover:ring-amber-200/15",
                        redSuWarnings.length > 0 && "border-t border-amber-200/10"
                      )}
                    >
                      <p className="whitespace-normal break-words">{visibleSuExpiryWarning}</p>
                      <button
                        className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border border-amber-300/30 text-amber-100/70 opacity-0 transition hover:border-amber-200 hover:bg-amber-200/10 hover:text-amber-50 group-hover:opacity-100"
                        onClick={() => {
                          writeSuExpiryDismissal(plan.id, {
                            dismissedAtSuUsed: suUsed,
                            lastSeenSuUsed: suUsed
                          });
                          setIsSuExpiryWarningDismissed(true);
                        }}
                        aria-label="Dismiss S/U expiry warning"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : null}
                  {!hasSuWarnings ? (
                    <p className="text-xs leading-5 text-muted">All good! No S/U policy warnings.</p>
                  ) : null}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <Card className="mb-5 overflow-hidden">
        <div className="grid grid-cols-[1.1fr_repeat(2,minmax(0,1fr))] border-b border-line bg-surface text-base font-semibold text-zinc-100">
          <div className="px-4 py-3">GPA</div>
          <div className="border-l border-line px-4 py-3">Pre-S/U</div>
          <div className="border-l border-line px-4 py-3">Post-S/U</div>
        </div>
        {[
          {
            label: "Current GPA",
            detail: currentSemesterLabel ? `Before ${currentSemesterLabel}` : "Before current semester",
            preSu: currentPreSu,
            postSu: currentPostSu
          },
          {
            label: "Entire Plan GPA",
            detail: "All planned semesters",
            preSu: entirePreSu,
            postSu: entirePostSu
          }
        ].map((row) => (
          <div key={row.label} className="grid grid-cols-[1.1fr_repeat(2,minmax(0,1fr))] border-b border-line last:border-b-0">
            <div className="px-4 py-3">
              <p className="text-base font-semibold">{row.label}</p>
              <p className="text-xs text-muted">{row.detail}</p>
            </div>
            {[row.preSu, row.postSu].map((result, index) => (
              <div key={index} className="border-l border-line px-4 py-3">
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    row.label === "Current GPA" && index === 1 && "text-[#ff007f]"
                  )}
                >
                  {formatGpa(result)}
                </p>
                <p className="text-xs text-muted">
                  {result.gradedUnits} graded units · {result.gradedModules} graded modules
                </p>
              </div>
            ))}
          </div>
        ))}
      </Card>

      <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
        {plan.semesters.map((semester) => {
          const gradeItems = semester.items.map((item, itemIndex) => ({ item, itemIndex }));
          const result = calculateGpa(semester);

          return (
            <Card
              key={semester.key}
              className={cn(
                "w-[320px] shrink-0 overflow-hidden sm:w-[360px]",
                semester.key === currentSemester && "border-[#ff007f] shadow-[0_0_0_1px_#ff007f]"
              )}
            >
              <div className="flex items-start justify-between gap-3 border-b border-line p-4">
                <div>
                  <h2 className="font-semibold">
                    {semester.key === "IBLOC" ? semesterLabels[semester.key] : semester.key}
                  </h2>
                  <p className="text-xs text-muted">{semester.label}</p>
                </div>
                <span className="text-xs text-muted">
                  {gradeItems.length} {gradeItems.length === 1 ? "item" : "items"}
                </span>
              </div>

              {gradeItems.length > 0 ? (
                <div className="divide-y divide-line">
                  {gradeItems.map(({ item, itemIndex }) => {
                    const itemLabel = item.type === "module" ? item.moduleCode : item.label;
                    return (
                      <div
                        key={item.id ?? `${semester.key}-${itemIndex}`}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{itemLabel}</p>
                          <p className="text-xs text-muted">
                            {item.units} units{item.type === "placeholder" ? " · Placeholder" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="relative w-32">
                            <Select
                              aria-label={`Grade for ${itemLabel}`}
                              className="w-full appearance-none pr-8"
                              value={item.grade === "S" || item.grade === "U" ? "" : item.grade ?? ""}
                              onChange={(event) =>
                                updateGrade(semester.key, itemIndex, event.target.value)
                              }
                              disabled={updateMutation.isPending}
                            >
                              <option value="">Grade</option>
                              {gpaGradeOptions.map((grade) => (
                                <option key={grade} value={grade}>
                                  {formatGradeOptionLabel(grade)}
                                </option>
                              ))}
                            </Select>
                            <ChevronDown
                              size={15}
                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                            />
                          </div>
                          <label className="group relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surface text-zinc-100 transition hover:border-zinc-500">
                            <input
                              type="checkbox"
                              aria-label={`S/U ${itemLabel}`}
                              checked={isSuItem(item)}
                              onChange={(event) => updateSu(semester.key, itemIndex, event.target.checked)}
                              disabled={updateMutation.isPending}
                              className="h-4 w-4 accent-[#ff007f]"
                            />
                            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-panel px-2 py-1 text-xs font-medium opacity-0 shadow-lg group-hover:opacity-100 group-focus-within:opacity-100">
                              S/U
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  No modules planned for this semester.
                </p>
              )}

              <div className="flex items-center justify-between border-t border-line bg-surface px-4 py-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted">Semester GPA</p>
                  <p className="text-xs text-muted">
                    {result.gradedUnits} graded units · {result.gradedModules} graded modules
                  </p>
                </div>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatGpa(result)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
