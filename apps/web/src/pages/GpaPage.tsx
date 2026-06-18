import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Check, LoaderCircle } from "lucide-react";
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

type GpaResult = {
  gpa: number | null;
  gradedUnits: number;
  gradedModules: number;
};

function calculateGpa(semester: SemesterPlan): GpaResult {
  let totalPoints = 0;
  let gradedUnits = 0;
  let gradedModules = 0;

  for (const item of semester.items) {
    if (
      item.type !== "module" ||
      !item.grade ||
      item.grade === "S" ||
      item.grade === "U"
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
          item.grade === "U"
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
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">GPA Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            Assign grades to modules in your plan. S/U grades do not affect GPA.
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

      <div className="grid gap-4 xl:grid-cols-2">
        {plan.semesters.map((semester) => {
          const modules = semester.items
            .map((item, itemIndex) => ({ item, itemIndex }))
            .filter(({ item }) => item.type === "module");
          const result = calculateGpa(semester);

          return (
            <Card key={semester.key} className="overflow-hidden">
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
                        <Select
                          aria-label={`Grade for ${item.moduleCode}`}
                          className="w-28 shrink-0"
                          value={item.grade ?? ""}
                          onChange={(event) =>
                            updateGrade(semester.key, itemIndex, event.target.value)
                          }
                          disabled={updateMutation.isPending}
                        >
                          <option value="">No grade</option>
                          {moduleGradeOptions.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))}
                        </Select>
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

      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line py-5">
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
