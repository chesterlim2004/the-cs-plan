import {
  baisRequirementSet,
  businessAnalyticsRequirementSet,
  bzaEconsDdpRequirementSet,
  csAy2025RequirementSet,
  csMathDoubleMajRequirementSet,
  csRequirementSet,
  getCompleteBaisModuleRequirementTags,
  getCompleteBusinessAnalyticsModuleRequirementTags,
  getCompleteBzaEconsDdpModuleRequirementTags,
  getCompleteCsMathDoubleMajModuleRequirementTags,
  getCompleteCsModuleRequirementTags
} from "@the-cs-plan/data";
import type { ModuleRequirementTags } from "@the-cs-plan/shared";
import { connectDb } from "./config/db.js";
import { assertServerEnv } from "./config/env.js";
import { ModuleModel } from "./models/Module.js";
import { ModuleRequirementTagsModel } from "./models/ModuleRequirementTags.js";
import { RequirementSetModel } from "./models/RequirementSet.js";
import { fetchNusmodsModules } from "./services/nusmodsImportService.js";

assertServerEnv();
await connectDb();

const acadYear = process.env.NUSMODS_ACAD_YEAR ?? "2026-2027";
const modules = await fetchNusmodsModules(acadYear);

await ModuleModel.bulkWrite(
  modules.map((module) => ({
    updateOne: {
      filter: { acadYear: module.acadYear, moduleCode: module.moduleCode },
      update: { $set: module },
      upsert: true
    }
  }))
);

const moduleRequirementTags = mergeModuleRequirementTags([
  ...getCompleteCsModuleRequirementTags(modules),
  ...getCompleteBusinessAnalyticsModuleRequirementTags(modules),
  ...getCompleteBaisModuleRequirementTags(modules),
  ...getCompleteBzaEconsDdpModuleRequirementTags(modules),
  ...getCompleteCsMathDoubleMajModuleRequirementTags(modules)
]);

const seededCurricula = [
  { programme: "computer-science", cohort: "AY2025/26" },
  { programme: "computer-science", cohort: "AY2026/27" },
  { programme: "business-analytics", cohort: "AY2025/26" },
  { programme: "business-artificial-intelligence-systems", cohort: "AY2025/26" },
  { programme: "business-analytics-economics-double-degree", cohort: "AY2025/26" },
  { programme: "computer-science-mathematics-double-major", cohort: "AY2025/26" }
] as const;

await Promise.all(
  seededCurricula.map(({ programme, cohort }) => {
    const seededModuleCodes = moduleRequirementTags
      .filter((mapping) => mapping.programme === programme && mapping.cohort === cohort)
      .map((mapping) => mapping.moduleCode);

    return ModuleRequirementTagsModel.deleteMany({
      programme,
      cohort,
      moduleCode: { $nin: seededModuleCodes }
    });
  })
);

await ModuleRequirementTagsModel.bulkWrite(
  moduleRequirementTags.map((mapping) => ({
    updateOne: {
      filter: {
        programme: mapping.programme,
        cohort: mapping.cohort,
        moduleCode: mapping.moduleCode
      },
      update: { $set: mapping },
      upsert: true
    }
  }))
);

const requirementSets = [
  csAy2025RequirementSet,
  csRequirementSet,
  businessAnalyticsRequirementSet,
  baisRequirementSet,
  bzaEconsDdpRequirementSet,
  csMathDoubleMajRequirementSet
];

await RequirementSetModel.bulkWrite(
  requirementSets.map((requirementSet) => ({
    updateOne: {
      filter: {
        programme: requirementSet.programme,
        cohort: requirementSet.cohort,
        version: requirementSet.version
      },
      update: { $set: requirementSet },
      upsert: true
    }
  }))
);

console.log(
  `Seeded ${modules.length} modules, ${moduleRequirementTags.length} module requirement mappings, and ${requirementSets.length} requirement sets.`
);
process.exit(0);

function mergeModuleRequirementTags(
  mappings: ModuleRequirementTags[]
): ModuleRequirementTags[] {
  const merged = new Map<string, ModuleRequirementTags>();

  for (const mapping of mappings) {
    const key = `${mapping.programme}:${mapping.cohort}:${mapping.moduleCode}`;
    const existing = merged.get(key);
    merged.set(key, {
      ...mapping,
      tags: Array.from(new Set([...(existing?.tags ?? []), ...mapping.tags]))
    });
  }

  return Array.from(merged.values());
}
