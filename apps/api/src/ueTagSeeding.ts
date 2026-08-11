import {
  CohortSchema,
  ProgrammeSchema,
  type Cohort,
  type Programme
} from "@the-cs-plan/shared";
import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { ModuleModel } from "./models/Module.js";
import { ModuleRequirementTagsModel } from "./models/ModuleRequirementTags.js";
import { RequirementSetModel } from "./models/RequirementSet.js";

interface CurriculumTarget {
  programme: Programme;
  cohort: Cohort;
}

const batchSize = 500;

async function main() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required.");
  }

  const selection = parseSelection(process.argv.slice(2));
  await connectDb();

  try {
    const targets = selection === "all"
      ? await listCurriculumTargets()
      : [selection];
    if (targets.length === 0) {
      throw new Error("The database contains no requirement sets.");
    }

    const moduleCodes = (await ModuleModel.distinct("moduleCode"))
      .map((moduleCode) => moduleCode.trim().toUpperCase());
    if (moduleCodes.length === 0) {
      throw new Error("The database contains no modules to classify.");
    }

    console.log(
      `Seeding UE mappings in ${mongoose.connection.host}/${mongoose.connection.name} `
      + `from ${moduleCodes.length} catalogue modules.`
    );

    let totalInserted = 0;
    let totalUpdated = 0;
    for (const target of targets) {
      const exists = await RequirementSetModel.exists(target);
      if (!exists) {
        throw new Error(
          `No requirement set exists for ${target.programme} ${target.cohort}.`
        );
      }

      const result = await seedCurriculumUeMappings(target, moduleCodes);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      console.log(
        `${target.programme} ${target.cohort}: inserted ${result.inserted}, `
        + `updated ${result.updated}, total UE mappings ${result.ueMappings}.`
      );
    }

    console.log(
      `UE tag seeding complete for ${targets.length} curricula: inserted `
      + `${totalInserted} and updated ${totalUpdated} mappings.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

async function seedCurriculumUeMappings(
  target: CurriculumTarget,
  moduleCodes: string[]
) {
  const existingMappings = await ModuleRequirementTagsModel.find(target)
    .select({ moduleCode: 1, tags: 1, _id: 0 })
    .lean();
  const existingByModuleCode = new Map(
    existingMappings.map((mapping) => [mapping.moduleCode, mapping.tags])
  );
  const emptyMappingCodes = moduleCodes.filter((moduleCode) => {
    const tags = existingByModuleCode.get(moduleCode);
    return tags !== undefined && tags.length === 0;
  });
  const missingMappingCodes = moduleCodes.filter(
    (moduleCode) => !existingByModuleCode.has(moduleCode)
  );

  let updated = 0;
  for (const batch of chunk(emptyMappingCodes, batchSize)) {
    const result = await ModuleRequirementTagsModel.updateMany(
      {
        ...target,
        moduleCode: { $in: batch },
        tags: { $size: 0 }
      },
      { $set: { tags: ["ue"] } }
    );
    updated += result.modifiedCount;
  }

  let inserted = 0;
  for (const batch of chunk(missingMappingCodes, batchSize)) {
    const result = await ModuleRequirementTagsModel.bulkWrite(
      batch.map((moduleCode) => ({
        updateOne: {
          filter: { ...target, moduleCode },
          update: {
            $setOnInsert: {
              ...target,
              moduleCode,
              tags: ["ue"]
            }
          },
          upsert: true
        }
      })),
      { ordered: false }
    );
    inserted += result.upsertedCount;
  }

  const ueMappings = await ModuleRequirementTagsModel.countDocuments({
    ...target,
    tags: "ue"
  });
  return { inserted, updated, ueMappings };
}

async function listCurriculumTargets(): Promise<CurriculumTarget[]> {
  const requirementSets = await RequirementSetModel.find()
    .select({ programme: 1, cohort: 1, _id: 0 })
    .lean();
  const targets = new Map<string, CurriculumTarget>();

  for (const requirementSet of requirementSets) {
    const target = {
      programme: ProgrammeSchema.parse(requirementSet.programme),
      cohort: CohortSchema.parse(requirementSet.cohort)
    };
    targets.set(`${target.programme}:${target.cohort}`, target);
  }

  return Array.from(targets.values());
}

function parseSelection(args: string[]): CurriculumTarget | "all" {
  if (args.includes("--all")) {
    if (args.length !== 1) {
      throw new Error("Use --all by itself, without programme or cohort options.");
    }
    return "all";
  }

  const programme = readOption(args, "--programme");
  const cohort = readOption(args, "--cohort");
  if (!programme || !cohort) {
    throw new Error(
      "Usage: npm run ueTagSeeding -- --programme <programme> --cohort <AYYYYY/YY>, or use --all."
    );
  }
  if (args.length !== 4) {
    throw new Error("Only --programme and --cohort are accepted for a targeted run.");
  }

  return {
    programme: ProgrammeSchema.parse(programme),
    cohort: CohortSchema.parse(cohort)
  };
}

function readOption(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

main().catch((error) => {
  console.error(
    `UE tag seeding failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
