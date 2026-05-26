import type {
  Module,
  ModulePlanItem,
  PlaceholderPlanItem,
  Plan,
  PlanItem,
  RequirementRule,
  RequirementSet
} from "@the-cs-plan/shared";

export interface RequirementProgress {
  id: string;
  label: string;
  completedUnits: number;
  requiredUnits: number;
  percentage: number;
  status: "fulfilled" | "partial" | "missing";
  contributors: string[];
  missing: string[];
  warnings: string[];
}

export interface EvaluationResult {
  requirementSetVersion: number;
  totalCompletedUnits: number;
  totalRequiredUnits: number;
  requirements: RequirementProgress[];
  warnings: string[];
}

export function evaluatePlan(
  requirementSet: RequirementSet,
  plan: Plan,
  modules: Module[]
): EvaluationResult {
  const moduleByCode = new Map(modules.map((module) => [module.moduleCode, module]));
  const items = plan.semesters.flatMap((semester) => semester.items);
  const moduleItems = items.filter((item): item is ModulePlanItem => item.type === "module");
  const placeholderItems = items.filter(
    (item): item is PlaceholderPlanItem => item.type === "placeholder"
  );

  const warnings = moduleItems
    .filter((item) => !moduleByCode.has(item.moduleCode))
    .map((item) => `Unknown module ${item.moduleCode} is included in the plan.`);

  const requirements = requirementSet.rules.map((rule) =>
    evaluateRule(rule, moduleItems, placeholderItems, moduleByCode)
  );

  return {
    requirementSetVersion: requirementSet.version,
    totalCompletedUnits: requirements.reduce((sum, requirement) => sum + requirement.completedUnits, 0),
    totalRequiredUnits: requirements.reduce((sum, requirement) => sum + requirement.requiredUnits, 0),
    requirements,
    warnings
  };
}

function evaluateRule(
  rule: RequirementRule,
  moduleItems: ModulePlanItem[],
  placeholderItems: PlaceholderPlanItem[],
  moduleByCode: Map<string, Module>
): RequirementProgress {
  if (rule.type === "module-list") {
    return evaluateModuleListRule(rule, moduleItems);
  }

  if (rule.type === "units-from-tags") {
    return evaluateUnitsFromTagsRule(rule, moduleItems, moduleByCode);
  }

  return evaluatePlaceholderRule(rule, placeholderItems);
}

function evaluateModuleListRule(
  rule: RequirementRule,
  moduleItems: ModulePlanItem[]
): RequirementProgress {
  const requiredModules = rule.requiredModules ?? [];
  const plannedModules = new Set(moduleItems.map((item) => item.moduleCode));
  const contributors = requiredModules.filter((moduleCode) => plannedModules.has(moduleCode));
  const missing = requiredModules.filter((moduleCode) => !plannedModules.has(moduleCode));
  const completedUnits = contributors.length * 4;
  const requiredUnits = requiredModules.length * 4;

  return formatProgress(rule, completedUnits, requiredUnits, contributors, missing, []);
}

function evaluateUnitsFromTagsRule(
  rule: RequirementRule,
  moduleItems: ModulePlanItem[],
  moduleByCode: Map<string, Module>
): RequirementProgress {
  const acceptedTags = new Set(rule.acceptedTags ?? []);
  const contributingItems = moduleItems.filter((item) => {
    const module = moduleByCode.get(item.moduleCode);
    return module?.requirementTags.some((tag) => acceptedTags.has(tag)) ?? false;
  });
  const completedUnits = contributingItems.reduce((sum, item) => sum + item.units, 0);
  const requiredUnits = rule.requiredUnits ?? 0;
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    contributingItems.map((item) => item.moduleCode),
    missingUnits > 0 ? [`${missingUnits} units remaining`] : [],
    []
  );
}

function evaluatePlaceholderRule(
  rule: RequirementRule,
  placeholderItems: PlaceholderPlanItem[]
): RequirementProgress {
  const acceptedPlaceholders = new Set(rule.acceptedPlaceholders ?? []);
  const contributingItems = placeholderItems.filter((item) =>
    acceptedPlaceholders.has(item.requirementId)
  );
  const completedUnits = contributingItems.reduce((sum, item) => sum + item.units, 0);
  const requiredUnits = rule.requiredUnits ?? 0;
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    contributingItems.map((item) => item.label),
    missingUnits > 0 ? [`${missingUnits} units remaining`] : [],
    []
  );
}

function formatProgress(
  rule: RequirementRule,
  completedUnits: number,
  requiredUnits: number,
  contributors: string[],
  missing: string[],
  warnings: string[]
): RequirementProgress {
  const cappedCompletedUnits = Math.min(completedUnits, requiredUnits);
  const percentage = requiredUnits === 0 ? 100 : Math.round((cappedCompletedUnits / requiredUnits) * 100);
  const status = percentage >= 100 ? "fulfilled" : percentage > 0 ? "partial" : "missing";

  return {
    id: rule.id,
    label: rule.label,
    completedUnits: cappedCompletedUnits,
    requiredUnits,
    percentage,
    status,
    contributors,
    missing,
    warnings
  };
}

export function getPrerequisiteWarnings(plan: Plan, modules: Module[]): string[] {
  const moduleByCode = new Map(modules.map((module) => [module.moduleCode, module]));
  const plannedCodes = new Set<string>();
  const warnings: string[] = [];

  for (const semester of plan.semesters) {
    for (const item of semester.items) {
      if (item.type !== "module") {
        continue;
      }

      const module = moduleByCode.get(item.moduleCode);
      if (module?.prerequisite && !hasAnyPriorModule(plannedCodes, module.prerequisite)) {
        warnings.push(`${item.moduleCode}: advisory prerequisite note - ${module.prerequisite}`);
      }

      plannedCodes.add(item.moduleCode);
    }
  }

  return warnings;
}

function hasAnyPriorModule(plannedCodes: Set<string>, prerequisite: string): boolean {
  const mentionedCodes = prerequisite.match(/[A-Z]{2,3}\d{4}[A-Z]?/g) ?? [];
  if (mentionedCodes.length === 0) {
    return true;
  }
  return mentionedCodes.some((code) => plannedCodes.has(code));
}
