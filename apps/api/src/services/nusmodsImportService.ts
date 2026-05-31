import { z } from "zod";
import { fallbackModules } from "@the-cs-plan/data";
import { ModuleSchema, type Module } from "@the-cs-plan/shared";

export const NusmodsModuleSchema = z.object({
  moduleCode: z.string(),
  title: z.string(),
  moduleCredit: z.union([z.string(), z.number()]).optional(),
  department: z.string().optional(),
  faculty: z.string().optional(),
  description: z.string().optional(),
  prerequisite: z.string().optional(),
  prereqTree: z.unknown().optional()
});

export type NusmodsModule = z.infer<typeof NusmodsModuleSchema>;

const moduleDetailConcurrency = 20;

export async function fetchNusmodsModules(acadYear: string): Promise<Module[]> {
  const url = `https://api.nusmods.com/v2/${acadYear}/moduleInfo.json`;
  const response = await fetch(url);

  if (!response.ok) {
    console.warn(
      `Could not fetch NUSMods module catalogue from ${url}; using local fallback modules.`
    );
    return fallbackModules.filter((module) => module.acadYear === acadYear);
  }

  const moduleSummaries = z.array(NusmodsModuleSchema).parse(await response.json());
  const detailedModules = await mapWithConcurrency(
    moduleSummaries,
    moduleDetailConcurrency,
    async (module) => ({
      ...module,
      ...(await fetchNusmodsModuleDetail(acadYear, module.moduleCode))
    })
  );
  return detailedModules.map((module) => normalizeNusmodsModule(acadYear, module));
}

export function normalizeNusmodsModule(acadYear: string, module: NusmodsModule): Module {
  return ModuleSchema.parse({
    acadYear,
    moduleCode: module.moduleCode,
    title: module.title,
    units: parseModuleUnits(module.moduleCredit),
    department: module.department,
    faculty: module.faculty,
    description: module.description,
    prerequisite: module.prerequisite,
    prereqTree: module.prereqTree
  });
}

function parseModuleUnits(moduleCredit: string | number | undefined): number {
  if (typeof moduleCredit === "number") {
    return Math.max(1, Math.round(moduleCredit));
  }

  const parsed = Number(moduleCredit);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 4;
}

async function fetchNusmodsModuleDetail(
  acadYear: string,
  moduleCode: string
): Promise<Partial<NusmodsModule>> {
  const url = `https://api.nusmods.com/v2/${acadYear}/modules/${moduleCode}.json`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {};
    }

    return NusmodsModuleSchema.partial().parse(await response.json());
  } catch {
    console.warn(`Could not fetch NUSMods detail for ${moduleCode}; using catalogue summary.`);
    return {};
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]!);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
