import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Check, ChevronDown, LoaderCircle } from "lucide-react";
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


function formatGradeOptionLabel(grade: ModuleGrade) {
  if (grade === "S" || grade === "U" || grade === "CS") {
    return `${grade} : Not in GPA`;
  }

  return `${grade} : ${gradePoints[grade].toFixed(2)}`;
}

function calculateGpa(semester: SemesterPlan): GpaResult {
  let totalPoints = 0;
  let gradedUnits = 0;
  let gradedModules = 0;

  for (const item of semester.items) {
    if (
      item.type !== "module" ||
      !item.grade ||
      item.grade === "S" ||
      item.grade === "U" ||
      item.grade === "CS"
    ) {
      continue;
    }

    totalPoints += gradePoints[item.grade] * item.units;
    gradedUnits += item.units;
    gradedModules += 1;
  }

  return {
    gpa: gradedUnits > 0 ? totalPoints / gradedUnits : null,
    gradedUnits,
    gradedModules
  };
}

function calculateCumulativeGpa(plan: Plan): GpaResult {
  const results = plan.semesters.map(calculateGpa);
  const gradedUnits = results.reduce((sum, result) => sum + result.gradedUnits, 0);
  const gradedModules = results.reduce((sum, result) => sum + result.gradedModules, 0);
  const totalPoints = plan.semesters.reduce((sum, semester) => {
    return (
      sum +
      semester.items.reduce((semesterSum, item) => {
        if (
          item.type !== "module" ||
          !item.grade ||
          item.grade === "S" ||
          item.grade === "U" ||
          item.grade === "CS"
        ) {
          return semesterSum;
        }
        return semesterSum + gradePoints[item.grade] * item.units;
      }, 0)
    );
  }, 0);

  return {
    gpa: gradedUnits > 0 ? totalPoints / gradedUnits : null,
    gradedUnits,
    gradedModules
  };
}

export function GpaPage() {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: api.listPlans });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const plan = plansQuery.data?.[0];
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

  if (plansQuery.isLoading) {
    return <div className="p-5 text-sm text-muted">Loading GPA tracker...</div>;
  }

  if (!plan) {
    return <div className="p-5 text-sm text-muted">No plan found. Add modules in the planner first.</div>;
  }

  const cumulative = calculateCumulativeGpa(plan);
  const currentSemester = profileQuery.data?.currentSemester ?? profileQuery.data?.startingSemester;

  function updateGrade(semesterKey: SemesterPlan["key"], itemIndex: number, grade: string) {
    const updatedPlan = structuredClone(plan!);
    const semester = updatedPlan.semesters.find((candidate) => candidate.key === semesterKey);
    const item = semester?.items[itemIndex];
    if (!item || item.type !== "module") {
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

  return (
    <div className="min-h-[calc(100vh-4rem)] p-5 pb-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">GPA Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            Assign grades to modules in your plan. S/U and CS grades do not affect GPA.
          </p>
        </div>
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

      <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
        {plan.semesters.map((semester) => {
          const modules = semester.items
            .map((item, itemIndex) => ({ item, itemIndex }))
            .filter(({ item }) => item.type === "module");
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
                  {modules.length} {modules.length === 1 ? "module" : "modules"}
                </span>
              </div>

              {modules.length > 0 ? (
                <div className="divide-y divide-line">
                  {modules.map(({ item, itemIndex }) => {
                    if (item.type !== "module") {
                      return null;
                    }
                    return (
                      <div
                        key={item.id ?? `${semester.key}-${itemIndex}`}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.moduleCode}</p>
                          <p className="text-xs text-muted">{item.units} units</p>
                        </div>
                        <div className="relative w-38 shrink-0">
                          <Select
                            aria-label={`Grade for ${item.moduleCode}`}
                            className="w-full appearance-none pr-9"
                            value={item.grade ?? ""}
                            onChange={(event) =>
                              updateGrade(semester.key, itemIndex, event.target.value)
                            }
                            disabled={updateMutation.isPending}
                          >
                            <option value="">No grade</option>
                            {moduleGradeOptions.map((grade) => (
                              <option key={grade} value={grade}>
                                {formatGradeOptionLabel(grade)}
                              </option>
                            ))}
                          </Select>
                          <ChevronDown
                            size={15}
                            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
                          />
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
                    {result.gradedUnits} graded units
                  </p>
                </div>
                <p className="text-2xl font-semibold tabular-nums">
                  {result.gpa === null ? "-" : result.gpa.toFixed(2)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <section className="fixed bottom-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur lg:left-64">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-line bg-panel">
            <Calculator size={19} />
          </div>
          <div>
            <h2 className="font-semibold">Cumulative GPA</h2>
            <p className="text-xs text-muted">
              {cumulative.gradedModules} graded modules · {cumulative.gradedUnits} graded units
            </p>
          </div>
        </div>
        <p className="text-3xl font-semibold tabular-nums">
          {cumulative.gpa === null ? "-" : cumulative.gpa.toFixed(2)}
        </p>
      </section>
    </div>
  );
}
