import {
  ModuleRequirementTagsSchema,
  RequirementSetSchema,
  type RequirementSet
} from "@the-cs-plan/shared";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { ModuleRequirementTagsModel } from "./models/ModuleRequirementTags.js";
import { RequirementSetModel } from "./models/RequirementSet.js";

const sourceMongoUri = process.env.SOURCE_MONGODB_URI ?? env.mongoUri;
const targetMongoUri = process.env.TARGET_MONGODB_URI;

if (!sourceMongoUri) {
  throw new Error(
    "SOURCE_MONGODB_URI is required, or configure MONGODB_URI in apps/api/.env."
  );
}
if (!targetMongoUri) {
  throw new Error("TARGET_MONGODB_URI is required.");
}
if (sourceMongoUri === targetMongoUri) {
  throw new Error("Source and target MongoDB URIs must be different.");
}

const [sourceConnection, targetConnection] = await Promise.all([
  mongoose.createConnection(sourceMongoUri).asPromise(),
  mongoose.createConnection(targetMongoUri).asPromise()
]);

try {
  if (
    sourceConnection.host === targetConnection.host
    && sourceConnection.name === targetConnection.name
  ) {
    throw new Error(
      `Source and target both resolve to ${sourceConnection.host}/${sourceConnection.name}.`
    );
  }

  console.log(
    `Reading curricula from ${sourceConnection.host}/${sourceConnection.name} and `
    + `promoting them to ${targetConnection.host}/${targetConnection.name}.`
  );

  const SourceRequirementSetModel = sourceConnection.model(
    RequirementSetModel.modelName,
    RequirementSetModel.schema
  );
  const SourceModuleRequirementTagsModel = sourceConnection.model(
    ModuleRequirementTagsModel.modelName,
    ModuleRequirementTagsModel.schema
  );
  const TargetRequirementSetModel = targetConnection.model(
    RequirementSetModel.modelName,
    RequirementSetModel.schema
  );
  const TargetModuleRequirementTagsModel = targetConnection.model(
    ModuleRequirementTagsModel.modelName,
    ModuleRequirementTagsModel.schema
  );

  const sourceRequirementSets = selectLatestRequirementSets(
    (await SourceRequirementSetModel.find()
      .sort({ programme: 1, cohort: 1, version: -1 })
      .lean())
      .map((requirementSet) => RequirementSetSchema.parse(requirementSet))
  );

  if (sourceRequirementSets.length === 0) {
    throw new Error("The source database contains no requirement sets.");
  }

  const curriculumFilters = sourceRequirementSets.map((requirementSet) => ({
    programme: requirementSet.programme,
    cohort: requirementSet.cohort
  }));
  const sourceMappings = (
    await SourceModuleRequirementTagsModel.find({ $or: curriculumFilters }).lean()
  ).map((mapping) => ModuleRequirementTagsSchema.parse(mapping));
  const targetRequirementSets = (
    await TargetRequirementSetModel.find({ $or: curriculumFilters })
      .sort({ programme: 1, cohort: 1, version: -1 })
      .lean()
  ).map((requirementSet) => RequirementSetSchema.parse(requirementSet));
  const latestTargetByCurriculum = new Map(
    selectLatestRequirementSets(targetRequirementSets).map((requirementSet) => [
      curriculumKey(requirementSet.programme, requirementSet.cohort),
      requirementSet
    ])
  );

  const promotableRequirementSets: RequirementSet[] = [];
  for (const sourceRequirementSet of sourceRequirementSets) {
    const latestTarget = latestTargetByCurriculum.get(
      curriculumKey(sourceRequirementSet.programme, sourceRequirementSet.cohort)
    );
    if (latestTarget && latestTarget.version >= sourceRequirementSet.version) {
      console.warn(
        `Skipping ${sourceRequirementSet.programme} `
        + `${sourceRequirementSet.cohort}: production v${latestTarget.version} is `
        + `${latestTarget.version === sourceRequirementSet.version ? "the same as" : "newer than"} `
        + `source v${sourceRequirementSet.version}.`
      );
      continue;
    }
    promotableRequirementSets.push(sourceRequirementSet);
  }

  const promotableCurriculumKeys = new Set(
    promotableRequirementSets.map((requirementSet) =>
      curriculumKey(requirementSet.programme, requirementSet.cohort)
    )
  );
  const promotableMappings = sourceMappings.filter((mapping) =>
    promotableCurriculumKeys.has(curriculumKey(mapping.programme, mapping.cohort))
  );
  const sourceModuleCodesByCurriculum = new Map<string, string[]>();
  for (const mapping of promotableMappings) {
    const key = curriculumKey(mapping.programme, mapping.cohort);
    const moduleCodes = sourceModuleCodesByCurriculum.get(key) ?? [];
    moduleCodes.push(mapping.moduleCode);
    sourceModuleCodesByCurriculum.set(key, moduleCodes);
  }

  let deletedMappingCount = 0;
  if (promotableRequirementSets.length > 0) {
    const session = await targetConnection.startSession();
    try {
      await session.withTransaction(async () => {
        await TargetRequirementSetModel.bulkWrite(
          promotableRequirementSets.map((requirementSet) => ({
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
          { ordered: false, session }
        );

        if (promotableMappings.length > 0) {
          await TargetModuleRequirementTagsModel.bulkWrite(
            promotableMappings.map((mapping) => ({
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
            { ordered: false, session }
          );
        }

        let transactionDeletedMappingCount = 0;
        for (const requirementSet of promotableRequirementSets) {
          const moduleCodes =
            sourceModuleCodesByCurriculum.get(
              curriculumKey(requirementSet.programme, requirementSet.cohort)
            ) ?? [];
          const result = await TargetModuleRequirementTagsModel.deleteMany(
            {
              programme: requirementSet.programme,
              cohort: requirementSet.cohort,
              moduleCode: { $nin: moduleCodes }
            },
            { session }
          );
          transactionDeletedMappingCount += result.deletedCount;
        }
        deletedMappingCount = transactionDeletedMappingCount;
      });
    } finally {
      await session.endSession();
    }
  }

  for (const requirementSet of promotableRequirementSets) {
    console.log(
      `Promoted ${requirementSet.programme} ${requirementSet.cohort} `
      + `v${requirementSet.version}.`
    );
  }
  console.log(
    `Promoted ${promotableRequirementSets.length} latest requirement sets and `
    + `${promotableMappings.length} module mappings; skipped `
    + `${sourceRequirementSets.length - promotableRequirementSets.length} curricula and deleted `
    + `${deletedMappingCount} stale production mappings.`
  );
} finally {
  await Promise.allSettled([
    sourceConnection.close(),
    targetConnection.close()
  ]);
}

function selectLatestRequirementSets(
  candidates: RequirementSet[]
): RequirementSet[] {
  const latestByCurriculum = new Map<string, RequirementSet>();

  for (const candidate of candidates) {
    const key = curriculumKey(candidate.programme, candidate.cohort);
    const current = latestByCurriculum.get(key);
    if (!current || candidate.version > current.version) {
      latestByCurriculum.set(key, candidate);
    }
  }

  return Array.from(latestByCurriculum.values());
}

function curriculumKey(
  programme: RequirementSet["programme"],
  cohort: RequirementSet["cohort"]
): string {
  return `${programme}:${cohort}`;
}
