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
import {
  ModuleRequirementTagsSchema,
  RequirementSetSchema,
  type ModuleRequirementTags,
  type RequirementSet
} from "@the-cs-plan/shared";
import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { ModuleModel } from "./models/Module.js";
import { ModuleRequirementTagsModel } from "./models/ModuleRequirementTags.js";
import { RequirementSetModel } from "./models/RequirementSet.js";

const minimumExpectedModuleCount = 1_000;
const requirementSets = selectLatestRequirementSets(
  [
    csAy2025RequirementSet,
    csRequirementSet,
    businessAnalyticsRequirementSet,
    baisRequirementSet,
    bzaEconsDdpRequirementSet,
    csMathDoubleMajRequirementSet
  ].map((requirementSet) => RequirementSetSchema.parse(requirementSet))
);

if (!env.mongoUri) {
  throw new Error("MONGODB_URI is required.");
}

await connectDb();

try {
  const modules = await ModuleModel.find().lean();
  if (modules.length < minimumExpectedModuleCount) {
    throw new Error(
      `Refusing to upsert curricula: the database contains only ${modules.length} modules.`
    );
  }

  for (const requirementSet of requirementSets) {
    const latestExisting = await RequirementSetModel.findOne({
      programme: requirementSet.programme,
      cohort: requirementSet.cohort
    }).sort({ version: -1 }).select({ version: 1 }).lean();

    if ((latestExisting?.version ?? 0) > requirementSet.version) {
      throw new Error(
        `Refusing to replace ${requirementSet.programme} ${requirementSet.cohort}: `
        + `production version ${latestExisting?.version} is newer than code version `
        + `${requirementSet.version}.`
      );
    }
  }

  const mappings = mergeModuleRequirementTags([
    ...getCompleteCsModuleRequirementTags(modules),
    ...getCompleteBusinessAnalyticsModuleRequirementTags(modules),
    ...getCompleteBaisModuleRequirementTags(modules),
    ...getCompleteBzaEconsDdpModuleRequirementTags(modules),
    ...getCompleteCsMathDoubleMajModuleRequirementTags(modules)
  ]).map((mapping) => ModuleRequirementTagsSchema.parse(mapping));

  await ModuleRequirementTagsModel.bulkWrite(
    mappings.map((mapping) => ({
      updateOne: {
        filter: {
          programme: mapping.programme,
          cohort: mapping.cohort,
          moduleCode: mapping.moduleCode
        },
        update: { $set: mapping },
        upsert: true
      }
    })),
    { ordered: false }
  );

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
    })),
    { ordered: false }
  );

  const mappingsByCurriculum = new Map<string, string[]>();
  for (const mapping of mappings) {
    const key = `${mapping.programme}:${mapping.cohort}`;
    const moduleCodes = mappingsByCurriculum.get(key) ?? [];
    moduleCodes.push(mapping.moduleCode);
    mappingsByCurriculum.set(key, moduleCodes);
  }

  let deletedMappingCount = 0;
  for (const [key, moduleCodes] of mappingsByCurriculum) {
    const separatorIndex = key.lastIndexOf(":");
    const programme = key.slice(0, separatorIndex);
    const cohort = key.slice(separatorIndex + 1);
    const result = await ModuleRequirementTagsModel.deleteMany({
      programme,
      cohort,
      moduleCode: { $nin: moduleCodes }
    });
    deletedMappingCount += result.deletedCount;
  }

  console.log(
    `Upserted ${requirementSets.length} requirement sets and ${mappings.length} mappings; `
    + `deleted ${deletedMappingCount} stale mappings.`
  );
} finally {
  await mongoose.disconnect();
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

function selectLatestRequirementSets(
  candidates: RequirementSet[]
): RequirementSet[] {
  const latestByCurriculum = new Map<string, RequirementSet>();

  for (const candidate of candidates) {
    const key = `${candidate.programme}:${candidate.cohort}`;
    const current = latestByCurriculum.get(key);
    if (!current || candidate.version > current.version) {
      latestByCurriculum.set(key, candidate);
    }
  }

  return Array.from(latestByCurriculum.values());
}
