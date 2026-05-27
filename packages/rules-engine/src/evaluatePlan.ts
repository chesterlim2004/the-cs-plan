import type {
  Module,
  ModulePlanItem,
  PlaceholderPlanItem,
  Plan,
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

interface OrderedModuleItem {
  key: string;
  item: ModulePlanItem;
  order: number;
}

interface OrderedPlaceholderItem {
  item: PlaceholderPlanItem;
  order: number;
}

interface AllocationState {
  claimedModuleKeys: Set<string>;
  overflowModuleKeys: Set<string>;
}

export function evaluatePlan(
  requirementSet: RequirementSet,
  plan: Plan,
  modules: Module[],
  moduleRequirementTags: Map<string, string[]> = new Map()
): EvaluationResult {
  const moduleByCode = new Map(modules.map((module) => [module.moduleCode, module]));
  const orderedModuleItems: OrderedModuleItem[] = [];
  const orderedPlaceholderItems: OrderedPlaceholderItem[] = [];
  let order = 0;

  for (const semester of plan.semesters) {
    for (const item of semester.items) {
      if (item.type === "module") {
        orderedModuleItems.push({ key: `${order}:${item.moduleCode}`, item, order });
      } else {
        orderedPlaceholderItems.push({ item, order });
      }
      order += 1;
    }
  }

  const warnings = orderedModuleItems
    .filter(({ item }) => !moduleByCode.has(item.moduleCode))
    .map(({ item }) => `Unknown module ${item.moduleCode} is included in the plan.`);

  const allocation: AllocationState = {
    claimedModuleKeys: new Set(),
    overflowModuleKeys: new Set()
  };
  const residualRules = requirementSet.rules.filter((rule) => rule.type === "residual-units");
  const nonResidualRules = requirementSet.rules.filter((rule) => rule.type !== "residual-units");
  const nonResidualRequirements = nonResidualRules.map((rule) =>
    evaluateRule(rule, orderedModuleItems, orderedPlaceholderItems, moduleByCode, moduleRequirementTags, allocation)
  );
  const residualRequirements = residualRules.map((rule) =>
    evaluateResidualRule(rule, orderedModuleItems, orderedPlaceholderItems, moduleByCode, moduleRequirementTags, allocation)
  );
  const requirementsById = new Map(
    [...nonResidualRequirements, ...residualRequirements].map((requirement) => [requirement.id, requirement])
  );
  const requirements = requirementSet.rules
    .map((rule) => requirementsById.get(rule.id))
    .filter((requirement): requirement is RequirementProgress => Boolean(requirement));

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
  moduleItems: OrderedModuleItem[],
  placeholderItems: OrderedPlaceholderItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  if (rule.type === "module-list") {
    return evaluateModuleListRule(rule, moduleItems, allocation);
  }

  if (rule.type === "units-from-tags") {
    return evaluateUnitsFromTagsRule(rule, moduleItems, placeholderItems, moduleByCode, moduleRequirementTags, allocation);
  }

  if (rule.type === "capped-units-from-tags") {
    return evaluateCappedUnitsFromTagsRule(rule, moduleItems, moduleByCode, moduleRequirementTags, allocation);
  }

  if (rule.type === "combined-units") {
    return evaluateCombinedUnitsRule(rule, moduleItems, placeholderItems, moduleByCode, moduleRequirementTags, allocation);
  }

  if (rule.type === "structured-idcd") {
    return evaluateStructuredIdCdRule(rule, moduleItems, placeholderItems, moduleByCode, moduleRequirementTags, allocation);
  }

  if (rule.type === "structured-breadth-depth") {
    return evaluateStructuredBreadthDepthRule(rule, moduleItems, moduleByCode, moduleRequirementTags, allocation);
  }

  return evaluatePlaceholderRule(rule, placeholderItems);
}

function evaluateModuleListRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  allocation: AllocationState
): RequirementProgress {
  const requiredModules = rule.requiredModules ?? [];
  const plannedModules = new Set(moduleItems.map(({ item }) => item.moduleCode));
  const contributors: string[] = [];

  for (const moduleCode of requiredModules) {
    const match = moduleItems.find(({ key, item }) =>
      !allocation.claimedModuleKeys.has(key) && item.moduleCode === moduleCode
    );
    if (match) {
      claimModule(allocation, match);
      contributors.push(moduleCode);
    }
  }

  const missing = requiredModules.filter((moduleCode) => !plannedModules.has(moduleCode));
  const completedUnits = contributors.length * 4;
  const requiredUnits = requiredModules.length * 4;

  return formatProgress(rule, completedUnits, requiredUnits, contributors, missing, []);
}

function evaluateUnitsFromTagsRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  placeholderItems: OrderedPlaceholderItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const acceptedTags = new Set((rule.acceptedTags ?? []).map(normalizeRequirementId));
  const acceptedPlaceholders = new Set((rule.acceptedPlaceholders ?? []).map(normalizeRequirementId));
  const orderedEligibleItems = [
    ...moduleItems
      .filter(({ key, item }) => {
        const module = moduleByCode.get(item.moduleCode);
        const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
        return !allocation.claimedModuleKeys.has(key) && Boolean(module) && tags.some((tag) => acceptedTags.has(tag));
      })
      .map((orderedItem) => ({ kind: "module" as const, orderedItem, order: orderedItem.order })),
    ...placeholderItems
      .filter(({ item }) => acceptedPlaceholders.has(normalizeRequirementId(item.requirementId)))
      .map((orderedItem) => ({ kind: "placeholder" as const, orderedItem, order: orderedItem.order }))
  ].sort((left, right) => left.order - right.order);
  const requiredUnits = rule.requiredUnits ?? 0;
  const contributingModuleItems: OrderedModuleItem[] = [];
  const contributingPlaceholderItems: OrderedPlaceholderItem[] = [];
  let completedUnits = 0;

  for (const orderedItem of orderedEligibleItems) {
    if (completedUnits < requiredUnits) {
      completedUnits += orderedItem.orderedItem.item.units;
      if (orderedItem.kind === "module") {
        claimModule(allocation, orderedItem.orderedItem);
        contributingModuleItems.push(orderedItem.orderedItem);
      } else {
        contributingPlaceholderItems.push(orderedItem.orderedItem);
      }
      continue;
    }

    if (orderedItem.kind === "module") {
      overflowModule(allocation, orderedItem.orderedItem);
    }
  }

  const missingUnits = Math.max(requiredUnits - completedUnits, 0);

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    [
      ...contributingModuleItems.map(({ item }) => item.moduleCode),
      ...contributingPlaceholderItems.map(({ item }) => item.label)
    ],
    missingUnits > 0 ? [`${missingUnits} units remaining`] : [],
    []
  );
}

function evaluateCappedUnitsFromTagsRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const acceptedTags = new Set((rule.acceptedTags ?? []).map(normalizeRequirementId));
  const tagCaps = new Map(
    (rule.tagCaps ?? []).map((cap) => [normalizeRequirementId(cap.tag), cap.maxUnits])
  );
  const completedUnitsByTag = new Map<string, number>();
  const contributingItems: OrderedModuleItem[] = [];

  for (const orderedItem of moduleItems) {
    const { key, item } = orderedItem;
    const module = moduleByCode.get(item.moduleCode);
    if (!module || allocation.claimedModuleKeys.has(key)) {
      continue;
    }

    const matchingTags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode).filter((tag) =>
      acceptedTags.has(tag)
    );
    if (matchingTags.length === 0) {
      continue;
    }

    const tagWithRoom = matchingTags.find((tag) => {
      const cap = tagCaps.get(tag);
      return cap === undefined || (completedUnitsByTag.get(tag) ?? 0) < cap;
    });

    if (tagWithRoom) {
      claimModule(allocation, orderedItem);
      completedUnitsByTag.set(tagWithRoom, (completedUnitsByTag.get(tagWithRoom) ?? 0) + item.units);
      contributingItems.push(orderedItem);
    } else {
      overflowModule(allocation, orderedItem);
    }
  }

  const completedUnits = Array.from(completedUnitsByTag.entries()).reduce((sum, [tag, units]) => {
    const cap = tagCaps.get(tag);
    return sum + (cap ? Math.min(units, cap) : units);
  }, 0);
  const requiredUnits = rule.requiredUnits ?? 0;
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    Array.from(new Set(contributingItems.map(({ item }) => item.moduleCode))),
    missingUnits > 0 ? [`${missingUnits} units remaining`] : [],
    []
  );
}

function evaluateCombinedUnitsRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  placeholderItems: OrderedPlaceholderItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const acceptedTags = new Set((rule.acceptedTags ?? []).map(normalizeRequirementId));
  const acceptedPlaceholders = new Set((rule.acceptedPlaceholders ?? []).map(normalizeRequirementId));
  const orderedEligibleItems = [
    ...moduleItems
      .filter(({ key, item }) => {
        const module = moduleByCode.get(item.moduleCode);
        const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
        return !allocation.claimedModuleKeys.has(key) && Boolean(module) && tags.some((tag) => acceptedTags.has(tag));
      })
      .map((orderedItem) => ({ kind: "module" as const, orderedItem, order: orderedItem.order })),
    ...placeholderItems
      .filter(({ item }) => acceptedPlaceholders.has(normalizeRequirementId(item.requirementId)))
      .map((orderedItem) => ({ kind: "placeholder" as const, orderedItem, order: orderedItem.order }))
  ].sort((left, right) => left.order - right.order);
  const requiredUnits = rule.requiredUnits ?? 0;
  const contributingModuleItems: OrderedModuleItem[] = [];
  const contributingPlaceholderItems: OrderedPlaceholderItem[] = [];
  let completedUnits = 0;

  for (const orderedItem of orderedEligibleItems) {
    if (completedUnits < requiredUnits) {
      completedUnits += orderedItem.orderedItem.item.units;
      if (orderedItem.kind === "module") {
        claimModule(allocation, orderedItem.orderedItem);
        contributingModuleItems.push(orderedItem.orderedItem);
      } else {
        contributingPlaceholderItems.push(orderedItem.orderedItem);
      }
      continue;
    }

    if (orderedItem.kind === "module") {
      overflowModule(allocation, orderedItem.orderedItem);
    }
  }

  const missingUnits = Math.max(requiredUnits - completedUnits, 0);

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    [
      ...contributingModuleItems.map(({ item }) => item.moduleCode),
      ...contributingPlaceholderItems.map(({ item }) => item.label)
    ],
    missingUnits > 0 ? [`${missingUnits} units remaining`] : [],
    []
  );
}

function evaluateStructuredIdCdRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  placeholderItems: OrderedPlaceholderItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const idTags = new Set((rule.idTags ?? []).map(normalizeRequirementId));
  const cdTags = new Set((rule.cdTags ?? []).map(normalizeRequirementId));
  const acceptedPlaceholders = new Set((rule.acceptedPlaceholders ?? []).map(normalizeRequirementId));
  const orderedEligibleItems = [
    ...moduleItems
      .filter(({ key, item }) => {
        const module = moduleByCode.get(item.moduleCode);
        const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
        return !allocation.claimedModuleKeys.has(key) && Boolean(module) && tags.some((tag) =>
          idTags.has(tag) || cdTags.has(tag)
        );
      })
      .map((orderedItem) => ({ kind: "module" as const, orderedItem, order: orderedItem.order })),
    ...placeholderItems
      .filter(({ item }) => acceptedPlaceholders.has(normalizeRequirementId(item.requirementId)))
      .map((orderedItem) => ({ kind: "placeholder" as const, orderedItem, order: orderedItem.order }))
  ].sort((left, right) => left.order - right.order);
  const requiredUnits = rule.requiredUnits ?? 0;
  const contributingModuleItems: OrderedModuleItem[] = [];
  const contributingPlaceholderItems: OrderedPlaceholderItem[] = [];
  let completedUnits = 0;

  for (const orderedItem of orderedEligibleItems) {
    if (completedUnits < requiredUnits) {
      completedUnits += orderedItem.orderedItem.item.units;
      if (orderedItem.kind === "module") {
        claimModule(allocation, orderedItem.orderedItem);
        contributingModuleItems.push(orderedItem.orderedItem);
      } else {
        contributingPlaceholderItems.push(orderedItem.orderedItem);
      }
      continue;
    }

    if (orderedItem.kind === "module") {
      overflowModule(allocation, orderedItem.orderedItem);
    }
  }

  const missing: string[] = [];
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);
  if (missingUnits > 0) {
    missing.push(`${missingUnits} units remaining`);
  }

  const idCourseCount = contributingModuleItems.filter(({ item }) =>
    getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode).some((tag) => idTags.has(tag))
  ).length + contributingPlaceholderItems.filter(({ item }) => idTags.has(normalizeRequirementId(item.requirementId))).length;
  const cdCourseCount = contributingModuleItems.filter(({ item }) =>
    getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode).some((tag) => cdTags.has(tag))
  ).length + contributingPlaceholderItems.filter(({ item }) => cdTags.has(normalizeRequirementId(item.requirementId))).length;
  const requiredIdMinCourses = rule.requiredIdMinCourses ?? 0;
  const allowedCdMaxCourses = rule.allowedCdMaxCourses;

  if (idCourseCount < requiredIdMinCourses) {
    missing.push(`${requiredIdMinCourses - idCourseCount} more ID course${requiredIdMinCourses - idCourseCount === 1 ? "" : "s"} required`);
  }

  if (allowedCdMaxCourses !== undefined && cdCourseCount > allowedCdMaxCourses) {
    missing.push(`At most ${allowedCdMaxCourses} CD course${allowedCdMaxCourses === 1 ? "" : "s"} may count`);
  }

  return formatProgressWithStatus(
    rule,
    completedUnits,
    requiredUnits,
    [
      ...contributingModuleItems.map(({ item }) => item.moduleCode),
      ...contributingPlaceholderItems.map(({ item }) => item.label)
    ],
    missing,
    [],
    completedUnits >= requiredUnits && missing.length > 0 ? "partial" : undefined
  );
}

function evaluateStructuredBreadthDepthRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const acceptedTags = new Set((rule.acceptedTags ?? []).map(normalizeRequirementId));
  const industryTags = new Set((rule.industryTags ?? []).map(normalizeRequirementId));
  const dissertationTags = new Set((rule.dissertationTags ?? []).map(normalizeRequirementId));
  const eligibleItems = moduleItems.filter(({ key, item }) => {
    const module = moduleByCode.get(item.moduleCode);
    const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
    return !allocation.claimedModuleKeys.has(key) && Boolean(module) && tags.some((tag) =>
      acceptedTags.has(tag) || industryTags.has(tag) || dissertationTags.has(tag)
    );
  });
  const requiredUnits = rule.requiredUnits ?? 0;
  const contributorItems = consumeUntilRequiredUnits(eligibleItems, requiredUnits, allocation);
  const contributorCodes = Array.from(new Set(contributorItems.map(({ item }) => item.moduleCode)));
  const completedUnits = contributorItems.reduce((sum, { item }) => sum + item.units, 0);
  const missing: string[] = [];

  const missingUnits = Math.max(requiredUnits - completedUnits, 0);
  if (missingUnits > 0) {
    missing.push(`${missingUnits} units remaining`);
  }

  const completedFocusArea = findCompletedFocusArea(rule, contributorCodes);
  if (!completedFocusArea) {
    missing.push("Complete one CS focus area with 3 modules, including at least one Level-4000 module");
  }

  const level4000Units = contributorItems
    .filter(({ item }) => getModuleLevel(item.moduleCode) >= 4000)
    .reduce((sum, { item }) => sum + item.units, 0);
  const requiredLevel4000Units = rule.requiredLevel4000Units ?? 0;
  if (level4000Units < requiredLevel4000Units) {
    missing.push(`${requiredLevel4000Units - level4000Units} Level-4000+ units remaining`);
  }

  const industryItems = contributorItems.filter(({ item }) =>
    getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode).some((tag) =>
      industryTags.has(tag)
    )
  );
  const hasDissertation = contributorItems.some(({ item }) =>
    getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode).some((tag) =>
      dissertationTags.has(tag)
    )
  );
  const industryUnits = industryItems.reduce((sum, { item }) => sum + item.units, 0);
  const requiredIndustryMinUnits = rule.requiredIndustryMinUnits ?? 0;
  const requiredIndustryMaxUnits = rule.requiredIndustryMaxUnits ?? Number.POSITIVE_INFINITY;

  if (!hasDissertation && industryUnits < requiredIndustryMinUnits) {
    missing.push(`${requiredIndustryMinUnits - industryUnits} Industry Experience units remaining`);
  }

  if (industryUnits > requiredIndustryMaxUnits) {
    missing.push(`Industry Experience exceeds maximum by ${industryUnits - requiredIndustryMaxUnits} units`);
  }

  const allowedPrefixes = rule.allowedNonIndustryPrefixes ?? [];
  const nonIndustryItems = contributorItems.filter(({ item }) =>
    !getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode).some((tag) =>
      industryTags.has(tag)
    )
  );
  const invalidNonIndustryCodes = nonIndustryItems
    .map(({ item }) => item.moduleCode)
    .filter((moduleCode) => !allowedPrefixes.some((prefix) => moduleCode.startsWith(prefix)));
  if (invalidNonIndustryCodes.length > 0) {
    missing.push(`Non-industry B&D modules must be ${allowedPrefixes.join("/")}-coded: ${Array.from(new Set(invalidNonIndustryCodes)).join(", ")}`);
  }

  const nonIndustryCpUnits = nonIndustryItems
    .filter(({ item }) => item.moduleCode.startsWith("CP"))
    .reduce((sum, { item }) => sum + item.units, 0);
  const maxNonIndustryCpUnits = rule.maxNonIndustryCpUnits;
  if (maxNonIndustryCpUnits !== undefined && nonIndustryCpUnits > maxNonIndustryCpUnits) {
    missing.push(`Non-industry CP-coded modules exceed maximum by ${nonIndustryCpUnits - maxNonIndustryCpUnits} units`);
  }

  return formatProgressWithStatus(
    rule,
    completedUnits,
    requiredUnits,
    contributorCodes,
    missing,
    [],
    completedUnits >= requiredUnits && missing.length > 0 ? "partial" : undefined
  );
}

function evaluateResidualRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  placeholderItems: OrderedPlaceholderItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const acceptedTags = new Set((rule.acceptedTags ?? []).map(normalizeRequirementId));
  const acceptedPlaceholders = new Set((rule.acceptedPlaceholders ?? []).map(normalizeRequirementId));
  const explicitModuleItems = moduleItems.filter(({ key, item }) => {
    const module = moduleByCode.get(item.moduleCode);
    const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
    return !allocation.claimedModuleKeys.has(key) && Boolean(module) && tags.some((tag) => acceptedTags.has(tag));
  });
  const overflowModuleItems = moduleItems.filter(({ key }) => allocation.overflowModuleKeys.has(key));
  const moduleContributors = dedupeOrderedModuleItems([...explicitModuleItems, ...overflowModuleItems]);
  const placeholderContributors = placeholderItems.filter(({ item }) =>
    acceptedPlaceholders.has(normalizeRequirementId(item.requirementId))
  );
  const completedUnits = [
    ...moduleContributors.map(({ item }) => item),
    ...placeholderContributors.map(({ item }) => item)
  ].reduce((sum, item) => sum + item.units, 0);
  const requiredUnits = rule.requiredUnits ?? 0;
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    [
      ...moduleContributors.map(({ item }) => item.moduleCode),
      ...placeholderContributors.map(({ item }) => item.label)
    ],
    missingUnits > 0 ? [`${missingUnits} units remaining`] : [],
    []
  );
}

function evaluatePlaceholderRule(
  rule: RequirementRule,
  placeholderItems: OrderedPlaceholderItem[]
): RequirementProgress {
  const acceptedPlaceholders = new Set((rule.acceptedPlaceholders ?? []).map(normalizeRequirementId));
  const contributingItems = placeholderItems.filter(({ item }) =>
    acceptedPlaceholders.has(normalizeRequirementId(item.requirementId))
  );
  const completedUnits = contributingItems.reduce((sum, { item }) => sum + item.units, 0);
  const requiredUnits = rule.requiredUnits ?? 0;
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    contributingItems.map(({ item }) => item.label),
    missingUnits > 0 ? [`${missingUnits} units remaining`] : [],
    []
  );
}

function consumeUntilRequiredUnits(
  items: OrderedModuleItem[],
  requiredUnits: number,
  allocation: AllocationState
): OrderedModuleItem[] {
  const contributingItems: OrderedModuleItem[] = [];
  let completedUnits = 0;

  for (const item of items) {
    if (completedUnits < requiredUnits) {
      claimModule(allocation, item);
      contributingItems.push(item);
      completedUnits += item.item.units;
    } else {
      overflowModule(allocation, item);
    }
  }

  return contributingItems;
}

function claimModule(allocation: AllocationState, orderedItem: OrderedModuleItem): void {
  allocation.claimedModuleKeys.add(orderedItem.key);
}

function overflowModule(allocation: AllocationState, orderedItem: OrderedModuleItem): void {
  allocation.claimedModuleKeys.add(orderedItem.key);
  allocation.overflowModuleKeys.add(orderedItem.key);
}

function dedupeOrderedModuleItems(items: OrderedModuleItem[]): OrderedModuleItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) {
      return false;
    }
    seen.add(item.key);
    return true;
  }).sort((left, right) => left.order - right.order);
}

function findCompletedFocusArea(rule: RequirementRule, contributorCodes: string[]): string | null {
  const plannedCodes = new Set(contributorCodes);
  const requiredPrimaryCount = rule.requiredFocusAreaPrimaryCount ?? 0;
  const requiredLevel4000PrimaryCount = rule.requiredFocusAreaLevel4000PrimaryCount ?? 0;

  for (const focusArea of rule.focusAreas ?? []) {
    const focusAreaModules = [
      ...focusArea.primaryModules,
      ...focusArea.electiveModules
    ];
    const completedFocusAreaModules = Array.from(new Set(focusAreaModules)).filter((moduleCode) =>
      plannedCodes.has(moduleCode)
    );
    const completedLevel4000FocusAreaModules = completedFocusAreaModules.filter((moduleCode) =>
      getModuleLevel(moduleCode) >= 4000
    );

    if (
      completedFocusAreaModules.length >= requiredPrimaryCount &&
      completedLevel4000FocusAreaModules.length >= requiredLevel4000PrimaryCount
    ) {
      return focusArea.id;
    }
  }

  return null;
}

function formatProgressWithStatus(
  rule: RequirementRule,
  completedUnits: number,
  requiredUnits: number,
  contributors: string[],
  missing: string[],
  warnings: string[],
  statusOverride?: RequirementProgress["status"]
): RequirementProgress {
  const progress = formatProgress(rule, completedUnits, requiredUnits, contributors, missing, warnings);
  return statusOverride ? { ...progress, status: statusOverride } : progress;
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
      if (module && !hasSatisfiedPrerequisites(plannedCodes, module)) {
        warnings.push(`${item.moduleCode}: advisory prerequisite note - ${module.prerequisite ?? "prerequisites not met"}`);
      }

      plannedCodes.add(item.moduleCode);
    }
  }

  return warnings;
}

function hasSatisfiedPrerequisites(plannedCodes: Set<string>, module: Module): boolean {
  if (module.prereqTree !== undefined) {
    return isPrereqTreeSatisfied(plannedCodes, module.prereqTree);
  }

  if (module.prerequisite) {
    return hasAnyPriorModule(plannedCodes, module.prerequisite);
  }

  return true;
}

function isPrereqTreeSatisfied(plannedCodes: Set<string>, node: unknown): boolean {
  if (typeof node === "string") {
    const mentionedCodes = extractModuleCodes(node);
    if (mentionedCodes.length === 0) {
      return true;
    }
    return mentionedCodes.some((code) => plannedCodes.has(code));
  }

  if (Array.isArray(node)) {
    return node.every((child) => isPrereqTreeSatisfied(plannedCodes, child));
  }

  if (!node || typeof node !== "object") {
    return true;
  }

  const tree = node as Record<string, unknown>;
  if (Array.isArray(tree.and)) {
    return tree.and.every((child) => isPrereqTreeSatisfied(plannedCodes, child));
  }

  if (Array.isArray(tree.or)) {
    return tree.or.some((child) => isPrereqTreeSatisfied(plannedCodes, child));
  }

  if (Array.isArray(tree.nOf)) {
    const [requiredCount, children] = tree.nOf;
    if (typeof requiredCount !== "number" || !Array.isArray(children)) {
      return true;
    }

    const satisfiedCount = children.filter((child) =>
      isPrereqTreeSatisfied(plannedCodes, child)
    ).length;
    return satisfiedCount >= requiredCount;
  }

  const values = Object.values(tree);
  return values.length === 0 || values.every((child) => isPrereqTreeSatisfied(plannedCodes, child));
}

function hasAnyPriorModule(plannedCodes: Set<string>, prerequisite: string): boolean {
  const mentionedCodes = extractModuleCodes(prerequisite);
  if (mentionedCodes.length === 0) {
    return true;
  }
  return mentionedCodes.some((code) => plannedCodes.has(code));
}

function extractModuleCodes(value: string): string[] {
  return value.match(/[A-Z]{2,3}\d{4}[A-Z]?/g) ?? [];
}

function getModuleLevel(moduleCode: string): number {
  const match = moduleCode.match(/^[A-Z]{2,3}(\d)/);
  return match ? Number(match[1]) * 1000 : 0;
}

function getNormalizedModuleRequirementTags(
  moduleRequirementTags: Map<string, string[]>,
  moduleCode: string
): string[] {
  return (moduleRequirementTags.get(moduleCode) ?? []).map(normalizeRequirementId);
}

function normalizeRequirementId(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}
