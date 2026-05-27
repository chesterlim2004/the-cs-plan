import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Save } from "lucide-react";
import type { StudentProfile } from "@the-cs-plan/shared";
import { semesterLabels, semesterOrder } from "@the-cs-plan/shared";
import { Button, Card, GhostButton, Select } from "../components/ui";
import { api } from "../lib/api";

const programmeOptions = [{ value: "computer-science", label: "Computer Science" }] as const;
const cohortOptions = [{ value: "AY2025/26", label: "AY2025/26" }] as const;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState<StudentProfile | null>(null);
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });

  useEffect(() => {
    if (profileQuery.data) {
      setProfileForm(profileQuery.data);
    }
  }, [profileQuery.data]);

  const profileMutation = useMutation({
    mutationFn: api.saveProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      await queryClient.invalidateQueries({ queryKey: ["evaluation"] });
      await queryClient.invalidateQueries({ queryKey: ["requirements"] });
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
            Changing these settings updates the requirement rules used by your account and resizes every saved plan.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Degree</span>
              <div className="relative">
                <Select
                  value={profileForm?.programme ?? "computer-science"}
                  onChange={(event) =>
                    setProfileForm((current) =>
                      current ? { ...current, programme: event.target.value as StudentProfile["programme"] } : current
                    )
                  }
                  disabled={!profileForm || profileMutation.isPending}
                  className="w-full appearance-none pr-10"
                >
                  {programmeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
                  disabled={!profileForm || profileMutation.isPending}
                  className="w-full appearance-none pr-10"
                >
                  {cohortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
              <span className="text-sm font-medium">Graduation semester</span>
              <div className="relative">
                <Select
                  value={profileForm?.graduationSemester ?? "Y4S2"}
                  onChange={(event) =>
                    setProfileForm((current) =>
                      current
                        ? {
                            ...current,
                            graduationSemester: event.target.value as StudentProfile["graduationSemester"]
                          }
                        : current
                    )
                  }
                  disabled={!profileForm || profileMutation.isPending}
                  className="w-full appearance-none pr-10"
                >
                  {semesterOrder.map((semesterKey) => (
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
            <Save size={16} /> Save academic profile
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
