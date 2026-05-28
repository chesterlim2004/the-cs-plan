import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  graduationSemesterOptions,
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
  const form = useForm<StudentProfile>({
    resolver: zodResolver(StudentProfileSchema),
    defaultValues: {
      programme: "computer-science",
      cohort: "AY2025/26",
      startingSemester: "Y1S1",
      graduationSemester: "Y4S2"
    }
  });

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
        <h1 className="text-2xl font-semibold">Set up your degree plan</h1>
        <p className="mt-2 text-sm text-muted">
          Milestone 1 supports Computer Science single degree for one cohort first.
        </p>

        <form className="mt-8 space-y-5" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Programme</span>
            <Select {...form.register("programme")}>
              <option value="computer-science">Computer Science</option>
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Cohort</span>
            <Select {...form.register("cohort")}>
              <option value="AY2025/26">AY2025/26</option>
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Starting Semester</span>
            <Select {...form.register("startingSemester")}>
              {startingSemesterOptions.map((semesterKey) => (
                <option key={semesterKey} value={semesterKey}>
                  {semesterKey === "IBLOC" ? "iBLOC" : `${semesterKey} · ${semesterLabels[semesterKey]}`}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Expected Graduation Semester</span>
            <Select {...form.register("graduationSemester")}>
              {graduationSemesterOptions.map((semesterKey) => (
                <option key={semesterKey} value={semesterKey}>
                  {semesterKey} · {semesterLabels[semesterKey]}
                </option>
              ))}
            </Select>
          </label>

          <Button className="w-full" disabled={mutation.isPending}>
            Create planner
          </Button>
        </form>
      </Card>
    </div>
  );
}
