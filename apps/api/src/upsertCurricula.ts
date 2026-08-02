import {
  ModuleRequirementTagsSchema,
  RequirementSetSchema,
  type ModuleRequirementTags,
  type RequirementSet
} from "@the-cs-plan/shared";
import mongoose, { type Connection, type Model } from "mongoose";
import { env } from "./config/env.js";
import {
  ModuleRequirementTagsModel,
  type ModuleRequirementTagsDocument
} from "./models/ModuleRequirementTags.js";
import {
  RequirementSetModel,
  type RequirementSetDocument
} from "./models/RequirementSet.js";

const mappingBatchSize = 500;

async function main() {
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

  const sourceConnection = await connect("source", sourceMongoUri);
  let targetConnection: Connection | null = null;

  try {
    targetConnection = await connect("target", targetMongoUri);
    assertDifferentDatabases(sourceConnection, targetConnection);

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

    const sourceCurriculumFilters = sourceRequirementSets.map(toCurriculumFilter);
    const targetRequirementVersions = await TargetRequirementSetModel.find({
      $or: sourceCurriculumFilters
    })
      .select({ programme: 1, cohort: 1, version: 1, _id: 0 })
      .lean();
    const latestTargetVersionByCurriculum = selectLatestVersions(targetRequirementVersions);

    const promotableRequirementSets: RequirementSet[] = [];
    for (const sourceRequirementSet of sourceRequirementSets) {
      const key = curriculumKey(sourceRequirementSet.programme, sourceRequirementSet.cohort);
      const latestTargetVersion = latestTargetVersionByCurriculum.get(key);
      if (latestTargetVersion !== undefined && latestTargetVersion >= sourceRequirementSet.version) {
        console.warn(
          `Skipping ${sourceRequirementSet.programme} ${sourceRequirementSet.cohort}: production `
          + `v${latestTargetVersion} is `
          + `${latestTargetVersion === sourceRequirementSet.version ? "the same as" : "newer than"} `
          + `source v${sourceRequirementSet.version}.`
        );
        continue;
      }
      promotableRequirementSets.push(sourceRequirementSet);
    }

    if (promotableRequirementSets.length === 0) {
      console.log(`Promoted 0 curricula; skipped all ${sourceRequirementSets.length} curricula.`);
      return;
    }

    const promotableFilters = promotableRequirementSets.map(toCurriculumFilter);
    const sourceMappings = (
      await SourceModuleRequirementTagsModel.find({ $or: promotableFilters }).lean()
    ).map((mapping) => ModuleRequirementTagsSchema.parse(mapping));
    const mappingsByCurriculum = groupMappingsByCurriculum(sourceMappings);

    let promotedMappingCount = 0;
    let deletedMappingCount = 0;
    for (const requirementSet of promotableRequirementSets) {
      const key = curriculumKey(requirementSet.programme, requirementSet.cohort);
      const mappings = mappingsByCurriculum.get(key) ?? [];
      const deleted = await promoteCurriculum(
        targetConnection,
        TargetRequirementSetModel,
        TargetModuleRequirementTagsModel,
        requirementSet,
        mappings
      );
      promotedMappingCount += mappings.length;
      deletedMappingCount += deleted;
      console.log(
        `Promoted ${requirementSet.programme} ${requirementSet.cohort} `
        + `v${requirementSet.version} with ${mappings.length} module mappings.`
      );
    }

    console.log(
      `Promoted ${promotableRequirementSets.length} latest requirement sets and `
      + `${promotedMappingCount} module mappings; skipped `
      + `${sourceRequirementSets.length - promotableRequirementSets.length} curricula and deleted `
      + `${deletedMappingCount} stale production mappings.`
    );
  } finally {
    await Promise.allSettled([
      sourceConnection.close(),
      targetConnection?.close()
    ]);
  }
}

async function connect(label: string, mongoUri: string): Promise<Connection> {
  try {
    return await mongoose.createConnection(mongoUri).asPromise();
  } catch (error) {
    throw new Error(`Could not connect to the ${label} MongoDB database: ${getErrorMessage(error)}`);
  }
}

function assertDifferentDatabases(source: Connection, target: Connection) {
  if (source.host === target.host && source.name === target.name) {
    throw new Error(`Source and target both resolve to ${source.host}/${source.name}.`);
  }
}

async function promoteCurriculum(
  targetConnection: Connection,
  TargetRequirementSetModel: Model<RequirementSetDocument>,
  TargetModuleRequirementTagsModel: Model<ModuleRequirementTagsDocument>,
  requirementSet: RequirementSet,
  mappings: ModuleRequirementTags[]
): Promise<number> {
  const session = await targetConnection.startSession();
  let deletedMappingCount = 0;

  try {
    await session.withTransaction(async () => {
      for (const batch of chunk(mappings, mappingBatchSize)) {
        await TargetModuleRequirementTagsModel.bulkWrite(
          batch.map((mapping) => ({
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

      const deletion = await TargetModuleRequirementTagsModel.deleteMany(
        {
          programme: requirementSet.programme,
          cohort: requirementSet.cohort,
          moduleCode: { $nin: mappings.map((mapping) => mapping.moduleCode) }
        },
        { session }
      );
      deletedMappingCount = deletion.deletedCount;

      // Write the requirement set last so it acts as the release marker for this curriculum.
      await TargetRequirementSetModel.updateOne(
        {
          programme: requirementSet.programme,
          cohort: requirementSet.cohort,
          version: requirementSet.version
        },
        { $set: requirementSet },
        { upsert: true, session }
      );
    });
  } catch (error) {
    throw new Error(
      `Failed to promote ${requirementSet.programme} ${requirementSet.cohort} `
      + `v${requirementSet.version}: ${getErrorMessage(error)}`
    );
  } finally {
    await session.endSession();
  }

  return deletedMappingCount;
}

function selectLatestRequirementSets(candidates: RequirementSet[]): RequirementSet[] {
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

function selectLatestVersions(
  candidates: Array<Pick<RequirementSetDocument, "programme" | "cohort" | "version">>
): Map<string, number> {
  const latestByCurriculum = new Map<string, number>();

  for (const candidate of candidates) {
    const key = curriculumKey(candidate.programme, candidate.cohort);
    const current = latestByCurriculum.get(key);
    if (current === undefined || candidate.version > current) {
      latestByCurriculum.set(key, candidate.version);
    }
  }

  return latestByCurriculum;
}

function groupMappingsByCurriculum(
  mappings: ModuleRequirementTags[]
): Map<string, ModuleRequirementTags[]> {
  const grouped = new Map<string, ModuleRequirementTags[]>();
  for (const mapping of mappings) {
    const key = curriculumKey(mapping.programme, mapping.cohort);
    grouped.set(key, [...(grouped.get(key) ?? []), mapping]);
  }
  return grouped;
}

function toCurriculumFilter(requirementSet: RequirementSet) {
  return {
    programme: requirementSet.programme,
    cohort: requirementSet.cohort
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function curriculumKey(
  programme: RequirementSet["programme"],
  cohort: RequirementSet["cohort"]
): string {
  return `${programme}:${cohort}`;
}

main().catch((error) => {
  console.error(`Curriculum upsert failed: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
