import { useQuery } from "@tanstack/react-query";
import { programmeLabels, type RequirementRule } from "@the-cs-plan/shared";
import { api } from "../lib/api";
import { Card } from "../components/ui";

export function RequirementsPage() {
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const profile = profileQuery.data;
  const query = useQuery({
    queryKey: ["requirements", profile?.programme, profile?.cohort],
    queryFn: () => api.getRequirements(profile!.programme, profile!.cohort),
    enabled: Boolean(profile)
  });

  return (
    <div className="p-5">
      <h1 className="text-2xl font-semibold">Degree Requirements</h1>
      <p className="mt-1 text-sm text-muted">
        {profile ? `${programmeLabels[profile.programme]}, ${profile.cohort}` : "Loading curriculum..."}
      </p>

      {(profileQuery.isLoading || query.isLoading) && (
        <p className="mt-5 text-sm text-muted">Loading requirements...</p>
      )}
      {(profileQuery.error || query.error) && (
        <Card className="mt-5 border-amber-500/30 p-4 text-sm text-amber-200">
          Could not load requirements. Check that the API is running and that you are logged in.
        </Card>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {query.data?.rules.map((rule) => (
          <Card key={rule.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{rule.label}</h2>
                <p className="mt-1 text-sm text-muted">
                  {rule.requiredUnits ? `${rule.requiredUnits} units` : `${(rule.requiredModules ?? []).length} modules`}
                </p>
              </div>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-300">
              {describeRequirement(rule).map((description) => (
                <li key={description}>{description}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function describeRequirement(rule: RequirementRule): string[] {
  if (rule.id === "university-pillars") {
    return [
      `Complete ${rule.requiredUnits ?? 0} units across the six university pillars.`,
      "Only one 4-unit course counts for each pillar.",
      `Pillars: ${(rule.tagCaps ?? []).map((cap) => formatTag(cap.tag)).join(", ")}.`
    ];
  }

  if (rule.type === "structured-idcd") {
    return [
      `Complete ${rule.requiredUnits ?? 0} units from Interdisciplinary and Cross-Disciplinary courses.`,
      `Take at least ${rule.requiredIdMinCourses ?? 0} ID courses.`,
      `Count no more than ${rule.allowedCdMaxCourses ?? 0} CD course.`
    ];
  }

  if (rule.type === "structured-breadth-depth") {
    return [
      `Complete ${rule.requiredUnits ?? 0} units of CS Breadth and Depth modules.`,
      `Complete one CS focus area with ${rule.requiredFocusAreaPrimaryCount ?? 0} focus-area modules, including at least ${rule.requiredFocusAreaLevel4000PrimaryCount ?? 0} Level-4000 module.`,
      `Complete at least ${rule.requiredLevel4000Units ?? 0} units at Level-4000 or above.`,
      `Complete ${rule.requiredIndustryMinUnits ?? 0} to ${rule.requiredIndustryMaxUnits ?? 0} units of Industry Experience, or use CP4101 as the dissertation replacement.`,
      `Non-industry modules must be ${rule.allowedNonIndustryPrefixes?.join("/") ?? "approved"}-coded.`,
      `At most ${rule.maxNonIndustryCpUnits ?? 0} units of non-industry CP-coded modules may count.`
    ];
  }

  if (rule.type === "residual-units") {
    return [
      `Complete ${rule.requiredUnits ?? 0} units of Unrestricted Electives.`,
      "Modules with no specific degree requirement tag count here.",
      "Overflow modules from completed requirements also count here."
    ];
  }

  if (rule.type === "module-list") {
    return [
      `Complete these modules: ${(rule.requiredModules ?? []).join(", ")}.`
    ];
  }

  if (rule.type === "module-choice") {
    return [
      `Complete one approved option: ${(rule.moduleOptions ?? [])
        .map((option) => option.join(" and "))
        .join("; or ")}.`
    ];
  }

  if (rule.type === "structured-programme-electives") {
    return [
      `Complete ${rule.requiredUnits ?? 0} units from approved programme electives across at least ${rule.requiredMinCourses ?? 0} courses.`,
      `Complete at least ${rule.requiredLevel4000MinCourses ?? 0} Level-4000 or higher courses.`,
      `Complete at least ${rule.requiredPrefixMinCourses ?? 0} ${rule.requiredPrefixes?.join("/") ?? "required-prefix"}-coded courses.`
    ];
  }

  if (rule.type === "structured-industry-experience") {
    return [
      `Complete ${rule.requiredUnits ?? 0} units through an approved full internship, two-part internship pathway, or dissertation replacement.`,
      `The two-part pathway requires ${rule.requiredFoundationUnits ?? 0} foundation units and ${rule.requiredCompanionUnits ?? 0} companion units.`,
      rule.advisory ?? "Published eligibility conditions apply to dissertation replacements."
    ];
  }

  if (rule.requiredUnits && rule.acceptedTags?.length) {
    const descriptions = [
      `Complete ${rule.requiredUnits} units from modules tagged ${rule.acceptedTags.map(formatTag).join(", ")}.`
    ];

    if (rule.acceptedPlaceholders?.length) {
      descriptions.push(`Matching placeholders can be used for planning: ${rule.acceptedPlaceholders.map(formatTag).join(", ")}.`);
    }

    return descriptions;
  }

  if (rule.requiredUnits && rule.acceptedPlaceholders?.length) {
    return [
      `Complete ${rule.requiredUnits} units using placeholders tagged ${rule.acceptedPlaceholders.map(formatTag).join(", ")}.`
    ];
  }

  return ["Requirement details are not available yet."];
}

function formatTag(tag: string): string {
  const normalized = tag.trim().toLowerCase().replace(/[\/_\s]+/g, "-");
  if (normalized === "id") {
    return "ID";
  }
  if (normalized === "cd") {
    return "CD";
  }
  if (normalized === "idcd" || normalized === "id-cd") {
    return "ID/CD";
  }
  if (normalized === "ue") {
    return "UE";
  }

  return normalized
    .split("-")
    .map((word) => (word === "cs" ? "CS" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}
