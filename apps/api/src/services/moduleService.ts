import { seededModules } from "@the-cs-plan/data";
import type { Module } from "@the-cs-plan/shared";
import { ModuleModel } from "../models/Module.js";

export async function searchModules(query: string): Promise<Module[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return ModuleModel.find().sort({ moduleCode: 1 }).limit(20).lean<Module[]>();
  }

  const regex = new RegExp(escapeRegExp(normalizedQuery), "i");
  const results = await ModuleModel.find({
    $or: [{ moduleCode: regex }, { title: regex }]
  })
    .sort({ moduleCode: 1 })
    .limit(20)
    .lean<Module[]>();

  return results.length > 0
    ? results
    : seededModules.filter(
        (module) => regex.test(module.moduleCode) || regex.test(module.title)
      );
}

export async function getModule(moduleCode: string): Promise<Module | null> {
  const normalizedCode = moduleCode.toUpperCase();
  return (
    (await ModuleModel.findOne({ moduleCode: normalizedCode }).lean<Module | null>()) ??
    seededModules.find((module) => module.moduleCode === normalizedCode) ??
    null
  );
}

export async function getAllModules(): Promise<Module[]> {
  const modules = await ModuleModel.find().lean<Module[]>();
  return modules.length > 0 ? modules : seededModules;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
