import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  getSemesterRange,
  graduationSemesterOptions,
  programmeLabels,
  semesterLabels,
  startingSemesterOptions,
  StudentProfileSchema,
  type StudentProfile
} from "@the-cs-plan/shared";
import { Button, Card, Select } from "../components/ui";
import { api } from "../lib/api";

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requirementSetsQuery = useQuery({
    queryKey: ["requirements", "catalog"],
    queryFn: api.listRequirementSets
  });
  const form = useForm<StudentProfile>({
    resolver: zodResolver(StudentProfileSchema),
    defaultValues: {
      programme: "computer-science",
      cohort: "AY2025/26",
      startingSemester: "Y1S1",
      currentSemester: "Y1S1",
      graduationSemester: "Y4S2"
    }
  });

  const startingSemester = form.watch("startingSemester");
  const graduationSemester = form.watch("graduationSemester");
  const programme = form.watch("programme");
  const cohort = form.watch("cohort");
  const programmeOptions = useMemo(
    () => Array.from(
      new Set((requirementSetsQuery.data?.curricula ?? []).map((item) => item.programme))
    ),
    [requirementSetsQuery.data?.curricula]
  );
  const cohortOptions = useMemo(
    () => (requirementSetsQuery.data?.curricula ?? [])
      .filter((item) => item.programme === programme)
      .map((item) => item.cohort),
    [programme, requirementSetsQuery.data?.curricula]
  );
  const currentSemesterOptions = useMemo(
    () => getSemesterRange(startingSemester, graduationSemester),
    [startingSemester, graduationSemester]
  );

  useEffect(() => {
    if (programmeOptions.length === 0) {
      return;
    }

    if (!programmeOptions.includes(programme)) {
      const nextProgramme = programmeOptions[0]!;
      const nextCohort = requirementSetsQuery.data?.curricula.find(
        (item) => item.programme === nextProgramme
      )?.cohort;
      form.setValue("programme", nextProgramme);
      if (nextCohort) {
        form.setValue("cohort", nextCohort);
      }
      return;
    }

    if (!cohortOptions.includes(cohort) && cohortOptions[0]) {
      form.setValue("cohort", cohortOptions[0]);
    }
  }, [cohort, cohortOptions, form, programme, programmeOptions, requirementSetsQuery.data?.curricula]);

  useEffect(() => {
    const currentSemester = form.getValues("currentSemester");
    if (!currentSemesterOptions.includes(currentSemester)) {
      form.setValue("currentSemester", startingSemester);
    }
  }, [currentSemesterOptions, form, startingSemester]);

  const mutation = useMutation({
    mutationFn: api.saveProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      navigate("/planner");
    }
  });

  return (
    <div className="grid min-h-screen place-items-center bg-surface p-6 text-zinc-100">
      <Card className="w-full max-w-lg p-8">
        <h1 className="pl-1 text-2xl font-semibold">Set up your degree plan</h1>

        <form className="mt-8 space-y-5" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <label className="block space-y-2">
            <span className="pl-1 text-sm font-medium">Programme</span>
            <div className="relative">
              <Select
                {...form.register("programme")}
                disabled={requirementSetsQuery.isLoading || requirementSetsQuery.isError}
                className="w-full appearance-none px-4 pr-11"
              >
                {programmeOptions.map((option) => (
                  <option key={option} value={option}>{programmeLabels[option]}</option>
                ))}
              </Select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="pl-1 text-sm font-medium">Cohort</span>
            <div className="relative">
              <Select
                {...form.register("cohort")}
                disabled={requirementSetsQuery.isLoading || requirementSetsQuery.isError}
                className="w-full appearance-none px-4 pr-11"
              >
                {cohortOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          </label>

          {requirementSetsQuery.isError ? (
            <p className="pl-1 text-xs text-red-300">Could not load the available degree rulesets.</p>
          ) : null}

          <label className="block space-y-2">
            <span className="pl-1 text-sm font-medium">Starting Semester</span>
            <div className="relative">
              <Select {...form.register("startingSemester")} className="w-full appearance-none pr-10">
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
            <span className="pl-1 text-sm font-medium">Current Semester</span>
            <div className="relative">
              <Select {...form.register("currentSemester")} className="w-full appearance-none pr-10">
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
            <span className="pl-1 text-sm font-medium">Expected Graduation Semester</span>
            <div className="relative">
              <Select {...form.register("graduationSemester")} className="w-full appearance-none pr-10">
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

          <Button
            className="w-full"
            disabled={
              mutation.isPending
              || requirementSetsQuery.isLoading
              || requirementSetsQuery.isError
              || programmeOptions.length === 0
              || cohortOptions.length === 0
            }
          >
            Create planner
          </Button>
        </form>
      </Card>
    </div>
  );
}
