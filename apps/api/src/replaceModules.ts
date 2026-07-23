import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { ModuleModel } from "./models/Module.js";
import { fetchNusmodsModules } from "./services/nusmodsImportService.js";

const acadYear = process.env.NUSMODS_ACAD_YEAR;
const minimumExpectedModuleCount = 1_000;

if (!env.mongoUri) {
  throw new Error("MONGODB_URI is required.");
}
if (!acadYear || !/^\d{4}-\d{4}$/.test(acadYear)) {
  throw new Error("Set NUSMODS_ACAD_YEAR using the format 2026-2027.");
}

await connectDb();

try {
  const modules = await fetchNusmodsModules(acadYear);
  const moduleCodes = Array.from(new Set(modules.map((module) => module.moduleCode)));

  if (
    modules.length < minimumExpectedModuleCount
    || moduleCodes.length !== modules.length
    || modules.some((module) => module.acadYear !== acadYear)
  ) {
    throw new Error(
      `Refusing to replace modules: NUSMods returned an invalid ${acadYear} catalogue `
      + `(${modules.length} modules, ${moduleCodes.length} unique codes).`
    );
  }

  const upsertResult = await ModuleModel.bulkWrite(
    modules.map((module) => ({
      updateOne: {
        filter: { acadYear, moduleCode: module.moduleCode },
        update: { $set: module },
        upsert: true
      }
    })),
    { ordered: false }
  );

  const deleteResult = await ModuleModel.deleteMany({
    $or: [
      { acadYear: { $ne: acadYear } },
      { acadYear, moduleCode: { $nin: moduleCodes } }
    ]
  });
  const finalCount = await ModuleModel.countDocuments({ acadYear });

  console.log(
    `Replaced module catalogue with ${finalCount} ${acadYear} modules: `
    + `${upsertResult.upsertedCount} inserted, ${upsertResult.modifiedCount} updated, `
    + `${deleteResult.deletedCount} stale modules deleted.`
  );
} finally {
  await mongoose.disconnect();
}
