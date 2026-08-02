import type { RequirementSet } from "@the-cs-plan/shared";
import { businessAnalyticsRequirementSet } from "./businessAnalyticsData.js";

const programme = "business-analytics-economics-double-major" as const;
const cohort = "AY2025/26" as const;

const economicsCoreModuleCodes = [
  "EC1101E",
  "EC2101",
  "EC2102",
  "EC2104",
  "EC2303",
  "EC3101",
  "EC3102",
  "EC3303"
];

const bzaRulesWithoutUnrestrictedElectives = businessAnalyticsRequirementSet.rules.filter(
  (rule) => rule.id !== "ue"
);

export const bzaEconsDoubleMajorRequirementSet: RequirementSet = {
  programme,
  cohort,
  version: 1,
  totalUnits: 160,
  sourceNote: "NUS BZA and Econs Double Major Curriculum AY25/26",
  redirectLink: "https://fass.nus.edu.sg/ecs/requirements-for-economics-major/",
  rules: [
    ...bzaRulesWithoutUnrestrictedElectives,
    {
      id: "economics-second-major-core",
      label: "Economics Second Major Core Courses",
      type: "module-list",
      requiredUnits: 32,
      requiredModules: economicsCoreModuleCodes
    },
    {
      id: "economics-second-major-upper-elective",
      label: "Economics Second Major Level-3000+ Elective",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["bza-econs-dm-economics-level3000-elective"]
    },
    {
      id: "economics-second-major-elective",
      label: "Economics Second Major Elective",
      type: "units-from-tags",
      requiredUnits: 4,
      acceptedTags: ["bza-econs-dm-economics-elective"]
    }
  ]
};
