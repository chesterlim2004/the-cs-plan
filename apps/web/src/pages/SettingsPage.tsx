import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Save } from "lucide-react";
import type { Plan, SemesterKey, StudentProfile } from "@the-cs-plan/shared";
import {
  getSemesterRange,
  graduationSemesterOptions,
  programmeLabels,
  semesterLabels,
  startingSemesterOptions
} from "@the-cs-plan/shared";
import { Button, Card, Select } from "../components/ui";
import { api } from "../lib/api";
import { clearCachedEvaluation, writeCachedEvaluation } from "../lib/evaluationCache";
import { clearDismissedWarningKeys } from "../lib/warningDismissalCache";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState<StudentProfile | null>(null);
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const requirementSetsQuery = useQuery({
    queryKey: ["requirements", "catalog"],
    queryFn: api.listRequirementSets
  });

  useEffect(() => {
    if (profileQuery.data) {
      setProfileForm(profileQuery.data);
    }
  }, [profileQuery.data]);

  const currentSemesterOptions = useMemo<SemesterKey[]>(() => {
    if (!profileForm) {
      return ["Y1S1"];
    }

    return getSemesterRange(profileForm.startingSemester, profileForm.graduationSemester);
  }, [profileForm?.startingSemester, profileForm?.graduationSemester]);
  const programmeOptions = useMemo(
    () => Array.from(
      new Set((requirementSetsQuery.data?.curricula ?? []).map((item) => item.programme))
    ),
    [requirementSetsQuery.data?.curricula]
  );
  const cohortOptions = useMemo(
    () => (requirementSetsQuery.data?.curricula ?? [])
      .filter((item) => item.programme === profileForm?.programme)
      .map((item) => item.cohort),
    [profileForm?.programme, requirementSetsQuery.data?.curricula]
  );

  const profileMutation = useMutation({
    mutationFn: api.saveProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      await queryClient.invalidateQueries({ queryKey: ["evaluation"] });
      await queryClient.invalidateQueries({ queryKey: ["requirements"] });

      const updatedPlans = await queryClient.fetchQuery({
        queryKey: ["plans"],
        queryFn: api.listPlans,
        staleTime: 0
      });

      await Promise.all(
        updatedPlans.flatMap((plan: Plan) => {
          if (!plan.id) {
            return [];
          }

          clearCachedEvaluation(plan.id);
          clearDismissedWarningKeys(plan.id);
          return api.evaluatePlan(plan.id).then((evaluation) => {
            writeCachedEvaluation(plan.id!, evaluation);
            queryClient.setQueryData(["evaluation", plan.id], evaluation);
          });
        })
      );
    }
  });

  function saveProfileChanges() {
    if (!profileForm) {
      return;
    }

    const confirmed = window.confirm(
      "This will affect the graduation requirements and ALL plans. Continue?"
    );
    if (!confirmed) {
      return;
    }

    profileMutation.mutate(profileForm);
  }

  return (
    <div className="max-w-5xl p-5">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Academic Profile</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Changing these settings updates the degree requirement rules used by your account and resizes every saved plan.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Degree</span>
              <div className="relative">
                <Select
                  value={profileForm?.programme ?? "computer-science"}
                  onChange={(event) =>
                    setProfileForm((current) => {
                      if (!current) {
                        return current;
                      }
                      const programme = event.target.value as StudentProfile["programme"];
                      const availableCohorts = (requirementSetsQuery.data?.curricula ?? [])
                        .filter((item) => item.programme === programme)
                        .map((item) => item.cohort);
                      return {
                        ...current,
                        programme,
                        cohort: availableCohorts.includes(current.cohort)
                          ? current.cohort
                          : availableCohorts[0] ?? current.cohort
                      };
                    })
                  }
                  disabled={!profileForm || profileMutation.isPending || requirementSetsQuery.isLoading}
                  className="w-full appearance-none pr-10"
                >
                  {programmeOptions.map((programme) => (
                    <option key={programme} value={programme}>
                      {programmeLabels[programme]}
                    </option>
                  ))}
                </Select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Cohort</span>
              <div className="relative">
                <Select
                  value={profileForm?.cohort ?? "AY2025/26"}
                  onChange={(event) =>
                    setProfileForm((current) =>
                      current ? { ...current, cohort: event.target.value as StudentProfile["cohort"] } : current
                    )
                  }
                  disabled={!profileForm || profileMutation.isPending || requirementSetsQuery.isLoading}
                  className="w-full appearance-none pr-10"
                >
                  {cohortOptions.map((cohort) => (
                    <option key={cohort} value={cohort}>
                      {cohort}
                    </option>
                  ))}
                </Select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </label>

            {requirementSetsQuery.isError ? (
              <p className="text-xs text-red-300">Could not load the available degree rulesets.</p>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium">Starting Semester</span>
              <div className="relative">
                <Select
                  value={profileForm?.startingSemester ?? "Y1S1"}
                  onChange={(event) =>
                    setProfileForm((current) => {
                      if (!current) {
                        return current;
                      }

                      const startingSemester = event.target.value as StudentProfile["startingSemester"];
                      const semesterRange = getSemesterRange(startingSemester, current.graduationSemester);
                      return {
                        ...current,
                        startingSemester,
                        currentSemester: semesterRange.includes(current.currentSemester)
                          ? current.currentSemester
                          : startingSemester
                      };
                    })
                  }
                  disabled={!profileForm || profileMutation.isPending}
                  className="w-full appearance-none pr-10"
                >
                  {startingSemesterOptions.map((semesterKey) => (
                    <option key={semesterKey} value={semesterKey}>
                      {semesterKey === "IBLOC" ? "iBLOC" : `${semesterKey} · ${semesterLabels[semesterKey]}`}
                    </option>
                  ))}
                </Select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Current Semester</span>
              <div className="relative">
                <Select
                  value={profileForm?.currentSemester ?? profileForm?.startingSemester ?? "Y1S1"}
                  onChange={(event) =>
                    setProfileForm((current) =>
                      current
                        ? {
                            ...current,
                            currentSemester: event.target.value as StudentProfile["currentSemester"]
                          }
                        : current
                    )
                  }
                  disabled={!profileForm || profileMutation.isPending}
                  className="w-full appearance-none pr-10"
                >
                  {currentSemesterOptions.map((semesterKey) => (
                    <option key={semesterKey} value={semesterKey}>
                      {semesterKey === "IBLOC" ? "iBLOC" : `${semesterKey} · ${semesterLabels[semesterKey]}`}
                    </option>
                  ))}
                </Select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Graduation Semester</span>
              <div className="relative">
                <Select
                  value={profileForm?.graduationSemester ?? "Y4S2"}
                  onChange={(event) =>
                    setProfileForm((current) => {
                      if (!current) {
                        return current;
                      }

                      const graduationSemester = event.target.value as StudentProfile["graduationSemester"];
                      const semesterRange = getSemesterRange(current.startingSemester, graduationSemester);
                      return {
                        ...current,
                        graduationSemester,
                        currentSemester: semesterRange.includes(current.currentSemester)
                          ? current.currentSemester
                          : current.startingSemester
                      };
                    })
                  }
                  disabled={!profileForm || profileMutation.isPending}
                  className="w-full appearance-none pr-10"
                >
                  {graduationSemesterOptions.map((semesterKey) => (
                    <option key={semesterKey} value={semesterKey}>
                      {semesterKey} · {semesterLabels[semesterKey]}
                    </option>
                  ))}
                </Select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </label>
          </div>

          <Button
            className="mt-5"
            onClick={saveProfileChanges}
            disabled={!profileForm || profileMutation.isPending}
          >
            <Save size={16} /> Save Academic Profile
          </Button>
        </Card>

        {/* Milestone 1 does not expose JSON export/import.
        <Card className="p-5">
          <h2 className="font-semibold">Export/Import Your Data</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Exports include your selected programme, cohort, graduation semester, semesters, module cards,
            and placeholders. They do not include Google IDs, tokens, sessions, or MongoDB IDs.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={exportPlan} disabled={!plan}>
              <Download size={16} /> Export JSON
            </Button>
            <GhostButton onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Import JSON
            </GhostButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importFile(file);
                }
              }}
            />
          </div>
        </Card>
        */}
      </div>
    </div>
  );
}
