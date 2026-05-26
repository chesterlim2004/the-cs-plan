import { csRequirementSet, seededModules } from "@the-cs-plan/data";
import { connectDb } from "./config/db.js";
import { assertServerEnv } from "./config/env.js";
import { ModuleModel } from "./models/Module.js";
import { RequirementSetModel } from "./models/RequirementSet.js";

assertServerEnv();
await connectDb();

await ModuleModel.bulkWrite(
  seededModules.map((module) => ({
    updateOne: {
      filter: { acadYear: module.acadYear, moduleCode: module.moduleCode },
      update: { $set: module },
      upsert: true
    }
  }))
);

await RequirementSetModel.updateOne(
  {
    programme: csRequirementSet.programme,
    cohort: csRequirementSet.cohort,
    version: csRequirementSet.version
  },
  { $set: csRequirementSet },
  { upsert: true }
);

console.log(`Seeded ${seededModules.length} modules and 1 requirement set.`);
process.exit(0);
