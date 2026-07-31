import type { Cohort, Programme } from "@the-cs-plan/shared";

const officialRequirementUrls: Partial<Record<Programme, Partial<Record<Cohort, string>>>> = {
  "computer-science": {
    "AY2025/26": "https://www.comp.nus.edu.sg/cug/per-cohort/cs/cs-25-26/",
    "AY2026/27": "https://www.comp.nus.edu.sg/cug/per-cohort/cs/cs-26-27/"
  },
  "business-analytics": {
    "AY2025/26": "https://www.comp.nus.edu.sg/cug/per-cohort/ba/ba-25-26/"
  },
  "business-artificial-intelligence-systems": {
    "AY2025/26": "https://www.comp.nus.edu.sg/cug/per-cohort/bais/bais-25-26/"
  },
  "business-analytics-economics-double-degree": {
    "AY2025/26": "https://www.comp.nus.edu.sg/cug/per-cohort/ddp-ba-econs/ddp-ba-econs-cohort-2025-2026/"
  },
  "computer-science-mathematics-double-major": {
    "AY2025/26": "https://www.math.nus.edu.sg/ug/ddp/"
  }
};

export function getOfficialRequirementsUrl(programme: Programme, cohort: Cohort): string | undefined {
  return officialRequirementUrls[programme]?.[cohort];
}
