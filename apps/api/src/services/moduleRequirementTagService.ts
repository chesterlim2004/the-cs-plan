import {
  fallbackModules,
  getCompleteBusinessAnalyticsModuleRequirementTags,
  getCompleteCsModuleRequirementTags
} from "@the-cs-plan/data";
import type { Cohort, ModuleRequirementTags, Programme } from "@the-cs-plan/shared";
import { ModuleRequirementTagsModel } from "../models/ModuleRequirementTags.js";

const fallbackModuleRequirementTags = mergeModuleRequirementTags([
  ...getCompleteCsModuleRequirementTags(fallbackModules),
  ...getCompleteBusinessAnalyticsModuleRequirementTags(fallbackModules)
]);

export async function listModuleRequirementTags(
  programme: Programme,
  cohort: Cohort
): Promise<ModuleRequirementTags[]> {
  const mappings = await ModuleRequirementTagsModel.find({ programme, cohort })
    .sort({ moduleCode: 1 })
    .lean<ModuleRequirementTags[]>();

  return mappings.length > 0
    ? mappings
    : fallbackModuleRequirementTags.filter(
        (mapping) => mapping.programme === programme && mapping.cohort === cohort
      );
}

export async function getModuleRequirementTagLookup(
  programme: Programme,
  cohort: Cohort
): Promise<Map<string, string[]>> {
  const mappings = await listModuleRequirementTags(programme, cohort);
  return new Map(mappings.map((mapping) => [mapping.moduleCode, mapping.tags]));
}

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
