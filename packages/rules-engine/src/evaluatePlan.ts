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
  overflowModuleUnits: Map<string, number>;
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
    overflowModuleKeys: new Set(),
    overflowModuleUnits: new Map()
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

  if (rule.type === "module-choice") {
    return evaluateModuleChoiceRule(rule, moduleItems, allocation);
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

  if (rule.type === "structured-programme-electives") {
    return evaluateStructuredProgrammeElectivesRule(rule, moduleItems, moduleByCode, moduleRequirementTags, allocation);
  }

  if (rule.type === "structured-industry-experience") {
    return evaluateStructuredIndustryExperienceRule(rule, moduleItems, moduleByCode, moduleRequirementTags, allocation);
  }

  if (rule.type === "structured-ddp-honours-pathway") {
    return evaluateStructuredDdpHonoursPathwayRule(
      rule,
      moduleItems,
      moduleByCode,
      moduleRequirementTags,
      allocation
    );
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
  const contributingItems: OrderedModuleItem[] = [];

  for (const moduleCode of requiredModules) {
    const match = moduleItems.find(({ key, item }) =>
      !allocation.claimedModuleKeys.has(key) && item.moduleCode === moduleCode
    );
    if (match) {
      claimModule(allocation, match);
      contributingItems.push(match);
    }
  }

  const missing = requiredModules.filter((moduleCode) => !plannedModules.has(moduleCode));
  const completedUnits = contributingItems.reduce((sum, { item }) => sum + item.units, 0);
  const requiredUnits = rule.requiredUnits ?? requiredModules.length * 4;
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);
  if (missing.length === 0 && missingUnits > 0) {
    missing.push(`${missingUnits} units remaining`);
  }

  return formatProgress(
    rule,
    completedUnits,
    requiredUnits,
    contributingItems.map(({ item }) => item.moduleCode),
    missing,
    []
  );
}

function evaluateModuleChoiceRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  allocation: AllocationState
): RequirementProgress {
  const moduleOptions = rule.moduleOptions ?? [];
  const requiredUnits = rule.requiredUnits ?? 0;
  const availableItems = moduleItems.filter(({ key }) => !allocation.claimedModuleKeys.has(key));
  const completeOption = moduleOptions.find((option) =>
    option.every((moduleCode) => availableItems.some(({ item }) => item.moduleCode === moduleCode))
  );

  if (completeOption) {
    const selectedItems = completeOption.map((moduleCode) =>
      availableItems.find(({ item }) => item.moduleCode === moduleCode)!
    );
    let remainingCreditedUnits = requiredUnits;
    for (const selectedItem of selectedItems) {
      const creditedUnits = Math.min(selectedItem.item.units, remainingCreditedUnits);
      claimModuleUnits(allocation, selectedItem, creditedUnits);
      remainingCreditedUnits = Math.max(remainingCreditedUnits - creditedUnits, 0);
    }
    return formatProgress(
      rule,
      requiredUnits,
      requiredUnits,
      selectedItems.map(({ item }) => item.moduleCode),
      [],
      []
    );
  }

  const bestPartialOption = [...moduleOptions].sort((left, right) => {
    const countPresent = (option: string[]) => option.filter((moduleCode) =>
      availableItems.some(({ item }) => item.moduleCode === moduleCode)
    ).length;
    return countPresent(right) - countPresent(left);
  })[0] ?? [];
  const presentCodes = bestPartialOption.filter((moduleCode) =>
    availableItems.some(({ item }) => item.moduleCode === moduleCode)
  );
  const missingCodes = bestPartialOption.filter((moduleCode) => !presentCodes.includes(moduleCode));

  return formatProgress(
    rule,
    0,
    requiredUnits,
    presentCodes,
    missingCodes.length > 0 ? [`Complete one option; missing ${missingCodes.join(", ")}`] : ["Complete one module option"],
    []
  );
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
  const requiredUnits = rule.requiredUnits ?? 0;
  const acceptedTags = (rule.acceptedTags ?? []).map(normalizeRequirementId);
  const acceptedTagSet = new Set(acceptedTags);
  const configuredCaps = new Map(
    (rule.tagCaps ?? []).map((cap) => [normalizeRequirementId(cap.tag), cap.maxUnits])
  );
  const tagCaps = acceptedTags.map((tag) => configuredCaps.get(tag) ?? requiredUnits);
  const eligibleItems = moduleItems.flatMap((orderedItem) => {
    const { key, item } = orderedItem;
    if (!moduleByCode.has(item.moduleCode) || allocation.claimedModuleKeys.has(key)) {
      return [];
    }
    const matchingTagIndexes = getNormalizedModuleRequirementTags(
      moduleRequirementTags,
      item.moduleCode
    ).flatMap((tag) => {
      if (!acceptedTagSet.has(tag)) {
        return [];
      }
      const tagIndex = acceptedTags.indexOf(tag);
      return tagIndex >= 0 ? [tagIndex] : [];
    });
    return matchingTagIndexes.length > 0 ? [{ orderedItem, matchingTagIndexes }] : [];
  });
  const assignment = findBestCappedTagAssignment(eligibleItems, tagCaps);
  const selectedByItemIndex = new Map(
    assignment.selections.map((selection) => [selection.itemIndex, selection])
  );
  const contributingItems: OrderedModuleItem[] = [];

  for (let itemIndex = 0; itemIndex < eligibleItems.length; itemIndex += 1) {
    const eligibleItem = eligibleItems[itemIndex]!;
    const selection = selectedByItemIndex.get(itemIndex);
    if (selection) {
      claimModuleUnits(allocation, eligibleItem.orderedItem, selection.creditedUnits);
      contributingItems.push(eligibleItem.orderedItem);
    } else {
      overflowModule(allocation, eligibleItem.orderedItem);
    }
  }

  const completedUnits = assignment.creditedUnits;
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

interface CappedTagEligibleItem {
  orderedItem: OrderedModuleItem;
  matchingTagIndexes: number[];
}

interface CappedTagSelection {
  itemIndex: number;
  tagIndex: number;
  creditedUnits: number;
}

interface CappedTagAssignment {
  creditedUnits: number;
  selections: CappedTagSelection[];
}

function findBestCappedTagAssignment(
  items: CappedTagEligibleItem[],
  tagCaps: number[]
): CappedTagAssignment {
  const memo = new Map<string, CappedTagAssignment>();

  function visit(itemIndex: number, usedUnitsByTag: number[]): CappedTagAssignment {
    if (itemIndex >= items.length) {
      return { creditedUnits: 0, selections: [] };
    }
    const key = `${itemIndex}:${usedUnitsByTag.join(",")}`;
    const cached = memo.get(key);
    if (cached) {
      return cached;
    }

    const item = items[itemIndex]!;
    let best = visit(itemIndex + 1, usedUnitsByTag);
    for (const tagIndex of item.matchingTagIndexes) {
      const remainingUnits = Math.max((tagCaps[tagIndex] ?? 0) - (usedUnitsByTag[tagIndex] ?? 0), 0);
      if (remainingUnits === 0) {
        continue;
      }
      const creditedUnits = Math.min(item.orderedItem.item.units, remainingUnits);
      const nextUsedUnits = [...usedUnitsByTag];
      nextUsedUnits[tagIndex] = (nextUsedUnits[tagIndex] ?? 0) + creditedUnits;
      const remainder = visit(itemIndex + 1, nextUsedUnits);
      const candidate: CappedTagAssignment = {
        creditedUnits: creditedUnits + remainder.creditedUnits,
        selections: [
          { itemIndex, tagIndex, creditedUnits },
          ...remainder.selections
        ]
      };
      if (candidate.creditedUnits >= best.creditedUnits) {
        best = candidate;
      }
    }

    memo.set(key, best);
    return best;
  }

  return visit(0, tagCaps.map(() => 0));
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

function evaluateStructuredProgrammeElectivesRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const acceptedTags = new Set((rule.acceptedTags ?? []).map(normalizeRequirementId));
  const requiredPrefixes = (rule.requiredPrefixes ?? []).map((prefix) => prefix.toUpperCase());
  const eligibleItems = moduleItems.filter(({ key, item }) => {
    const module = moduleByCode.get(item.moduleCode);
    const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
    const availableUnits = allocation.claimedModuleKeys.has(key)
      ? allocation.overflowModuleUnits.get(key) ?? 0
      : item.units;
    return availableUnits > 0
      && Boolean(module)
      && tags.some((tag) => acceptedTags.has(tag));
  }).map((orderedItem) => ({
    orderedItem,
    creditedUnits: allocation.claimedModuleKeys.has(orderedItem.key)
      ? allocation.overflowModuleUnits.get(orderedItem.key) ?? 0
      : orderedItem.item.units
  }));
  const requiredUnits = rule.requiredUnits ?? 0;
  const requiredMinCourses = rule.requiredMinCourses ?? 0;
  const requiredLevel4000MinCourses = rule.requiredLevel4000MinCourses ?? 0;
  const requiredPrefixMinCourses = rule.requiredPrefixMinCourses ?? 0;
  const selectedItems: typeof eligibleItems = [];
  const remainingItems = [...eligibleItems];

  while (
    remainingItems.length > 0
    && (
      selectedItems.length < requiredMinCourses
      || selectedItems.reduce((sum, item) => sum + item.creditedUnits, 0) < requiredUnits
    )
  ) {
    const level4000Count = selectedItems.filter(({ orderedItem }) =>
      getModuleLevel(orderedItem.item.moduleCode) >= 4000
    ).length;
    const prefixCount = selectedItems.filter(({ orderedItem }) =>
      requiredPrefixes.some((prefix) => orderedItem.item.moduleCode.startsWith(prefix))
    ).length;
    const needsLevel4000 = level4000Count < requiredLevel4000MinCourses;
    const needsPrefix = prefixCount < requiredPrefixMinCourses;
    let bestIndex = 0;
    let bestScore = -1;

    for (let index = 0; index < remainingItems.length; index += 1) {
      const candidate = remainingItems[index]!;
      const score = Number(
        needsLevel4000 && getModuleLevel(candidate.orderedItem.item.moduleCode) >= 4000
      ) + Number(
        needsPrefix && requiredPrefixes.some((prefix) =>
          candidate.orderedItem.item.moduleCode.startsWith(prefix)
        )
      );
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    selectedItems.push(remainingItems.splice(bestIndex, 1)[0]!);
  }

  for (const item of selectedItems) {
    consumeAvailableModuleUnits(allocation, item.orderedItem, item.creditedUnits);
  }
  for (const item of remainingItems) {
    if (!allocation.claimedModuleKeys.has(item.orderedItem.key)) {
      overflowModule(allocation, item.orderedItem);
    }
  }

  const completedUnits = selectedItems.reduce((sum, item) => sum + item.creditedUnits, 0);
  const level4000Count = selectedItems.filter(({ orderedItem }) =>
    getModuleLevel(orderedItem.item.moduleCode) >= 4000
  ).length;
  const prefixCount = selectedItems.filter(({ orderedItem }) =>
    requiredPrefixes.some((prefix) => orderedItem.item.moduleCode.startsWith(prefix))
  ).length;
  const missing: string[] = [];
  const missingUnits = Math.max(requiredUnits - completedUnits, 0);
  if (missingUnits > 0) {
    missing.push(`${missingUnits} programme elective units remaining`);
  }
  if (selectedItems.length < requiredMinCourses) {
    const remainingCourses = requiredMinCourses - selectedItems.length;
    missing.push(`${remainingCourses} more programme elective course${remainingCourses === 1 ? "" : "s"} required`);
  }
  if (level4000Count < requiredLevel4000MinCourses) {
    const remainingCourses = requiredLevel4000MinCourses - level4000Count;
    missing.push(`${remainingCourses} more Level-4000+ programme elective course${remainingCourses === 1 ? "" : "s"} required`);
  }
  if (prefixCount < requiredPrefixMinCourses) {
    const remainingCourses = requiredPrefixMinCourses - prefixCount;
    missing.push(`${remainingCourses} more ${requiredPrefixes.join("/")}-coded programme elective course${remainingCourses === 1 ? "" : "s"} required`);
  }

  return formatProgressWithStatus(
    rule,
    completedUnits,
    requiredUnits,
    selectedItems.map(({ orderedItem }) => orderedItem.item.moduleCode),
    missing,
    [],
    completedUnits >= requiredUnits && missing.length > 0 ? "partial" : undefined
  );
}

interface CreditedIndustryItem {
  orderedItem: OrderedModuleItem;
  creditedUnits: number;
}

interface IndustryPathway {
  kind: "industry" | "internship" | "dissertation";
  items: CreditedIndustryItem[];
  creditedUnits: number;
  complete: boolean;
}

function evaluateStructuredIndustryExperienceRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const industryTags = new Set((rule.industryTags ?? []).map(normalizeRequirementId));
  const foundationTags = new Set((rule.internshipFoundationTags ?? []).map(normalizeRequirementId));
  const secondInternshipTags = new Set((rule.secondInternshipTags ?? []).map(normalizeRequirementId));
  const supplementaryTags = new Set((rule.supplementaryTags ?? []).map(normalizeRequirementId));
  const dissertationTags = new Set((rule.dissertationTags ?? []).map(normalizeRequirementId));
  const tagUnitOverrides = new Map(
    (rule.tagUnitOverrides ?? []).map((override) => [normalizeRequirementId(override.tag), override.units])
  );
  const eligibleItems = moduleItems.filter(({ key, item }) => {
    if (allocation.claimedModuleKeys.has(key) || !moduleByCode.has(item.moduleCode)) {
      return false;
    }
    const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
    return tags.some((tag) =>
      industryTags.has(tag)
      || foundationTags.has(tag)
      || secondInternshipTags.has(tag)
      || supplementaryTags.has(tag)
      || dissertationTags.has(tag)
    );
  });
  const requiredUnits = rule.requiredUnits ?? 0;
  const industryItems = takeCreditedIndustryItems(
    eligibleItems,
    industryTags,
    requiredUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const dissertationItems = takeCreditedIndustryItems(
    eligibleItems,
    dissertationTags,
    requiredUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const requiredFoundationUnits = rule.requiredFoundationUnits ?? Math.ceil(requiredUnits / 2);
  const requiredCompanionUnits = rule.requiredCompanionUnits ?? Math.max(requiredUnits - requiredFoundationUnits, 0);
  const foundationItems = takeCreditedIndustryItems(
    eligibleItems,
    foundationTags,
    requiredFoundationUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const companionItems = takeCreditedIndustryItems(
    eligibleItems.filter((candidate) =>
      !foundationItems.some(({ orderedItem }) => orderedItem.key === candidate.key)
    ),
    new Set([...secondInternshipTags, ...supplementaryTags]),
    requiredCompanionUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const foundationUnits = sumCreditedIndustryUnits(foundationItems);
  const companionUnits = sumCreditedIndustryUnits(companionItems);
  const pathways: IndustryPathway[] = [
    {
      kind: "industry",
      items: industryItems,
      creditedUnits: sumCreditedIndustryUnits(industryItems),
      complete: sumCreditedIndustryUnits(industryItems) >= requiredUnits
    },
    {
      kind: "dissertation",
      items: dissertationItems,
      creditedUnits: sumCreditedIndustryUnits(dissertationItems),
      complete: sumCreditedIndustryUnits(dissertationItems) >= requiredUnits
    },
    {
      kind: "internship",
      items: [...foundationItems, ...companionItems],
      creditedUnits: foundationUnits + companionUnits,
      complete: foundationUnits >= requiredFoundationUnits && companionUnits >= requiredCompanionUnits
    }
  ];
  const selectedPathway = pathways
    .sort((left, right) => {
      if (left.complete !== right.complete) {
        return Number(right.complete) - Number(left.complete);
      }
      if (left.creditedUnits !== right.creditedUnits) {
        return right.creditedUnits - left.creditedUnits;
      }
      const leftOrder = left.items.length > 0
        ? Math.max(...left.items.map(({ orderedItem }) => orderedItem.order))
        : Number.POSITIVE_INFINITY;
      const rightOrder = right.items.length > 0
        ? Math.max(...right.items.map(({ orderedItem }) => orderedItem.order))
        : Number.POSITIVE_INFINITY;
      return leftOrder - rightOrder;
    })[0]!;

  for (const { orderedItem, creditedUnits } of selectedPathway.items) {
    claimModuleUnits(allocation, orderedItem, creditedUnits);
  }

  const completedUnits = Math.min(selectedPathway.creditedUnits, requiredUnits);
  const missing: string[] = [];
  if (!selectedPathway.complete) {
    const remainingUnits = Math.max(requiredUnits - completedUnits, 0);
    if (remainingUnits > 0) {
      missing.push(`${remainingUnits} Industry Experience units remaining`);
    }
    missing.push("Complete one valid Industry Experience or dissertation pathway");
  }
  const warnings = selectedPathway.kind === "dissertation" && rule.advisory
    ? [rule.advisory]
    : [];

  return formatProgressWithStatus(
    rule,
    completedUnits,
    requiredUnits,
    selectedPathway.items.map(({ orderedItem }) => orderedItem.item.moduleCode),
    missing,
    warnings,
    completedUnits >= requiredUnits && missing.length > 0 ? "partial" : undefined
  );
}

function takeCreditedIndustryItems(
  items: OrderedModuleItem[],
  acceptedTags: Set<string>,
  requiredUnits: number,
  moduleRequirementTags: Map<string, string[]>,
  tagUnitOverrides: Map<string, number>
): CreditedIndustryItem[] {
  const selected: CreditedIndustryItem[] = [];
  let creditedUnits = 0;

  for (const orderedItem of items) {
    const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, orderedItem.item.moduleCode)
      .filter((tag) => acceptedTags.has(tag));
    if (tags.length === 0 || creditedUnits >= requiredUnits) {
      continue;
    }
    const overrideUnits = tags
      .map((tag) => tagUnitOverrides.get(tag))
      .filter((units): units is number => units !== undefined);
    const itemCreditedUnits = Math.min(
      orderedItem.item.units,
      overrideUnits.length > 0 ? Math.max(...overrideUnits) : orderedItem.item.units
    );
    selected.push({ orderedItem, creditedUnits: itemCreditedUnits });
    creditedUnits += itemCreditedUnits;
  }

  return selected;
}

function sumCreditedIndustryUnits(items: CreditedIndustryItem[]): number {
  return items.reduce((sum, item) => sum + item.creditedUnits, 0);
}

interface DdpHonoursPathway {
  kind: "integrated-thesis" | "internship";
  items: CreditedIndustryItem[];
  completedUnits: number;
  requiredUnits: number;
  economicsUnits: number;
  requiredEconomicsUnits: number;
  economicsLevel4000Units: number;
  requiredEconomicsLevel4000Units: number;
  thesisOrIndustryUnits: number;
  requiredThesisOrIndustryUnits: number;
  complete: boolean;
  score: number;
}

function evaluateStructuredDdpHonoursPathwayRule(
  rule: RequirementRule,
  moduleItems: OrderedModuleItem[],
  moduleByCode: Map<string, Module>,
  moduleRequirementTags: Map<string, string[]>,
  allocation: AllocationState
): RequirementProgress {
  const integratedThesisTags = new Set(
    (rule.integratedThesisTags ?? []).map(normalizeRequirementId)
  );
  const economicsElectiveTags = new Set(
    (rule.economicsElectiveTags ?? []).map(normalizeRequirementId)
  );
  const economicsLevel4000Tags = new Set(
    (rule.economicsLevel4000Tags ?? []).map(normalizeRequirementId)
  );
  const industryTags = new Set((rule.industryTags ?? []).map(normalizeRequirementId));
  const foundationTags = new Set(
    (rule.internshipFoundationTags ?? []).map(normalizeRequirementId)
  );
  const companionTags = new Set([
    ...(rule.secondInternshipTags ?? []).map(normalizeRequirementId),
    ...(rule.supplementaryTags ?? []).map(normalizeRequirementId)
  ]);
  const tagUnitOverrides = new Map(
    (rule.tagUnitOverrides ?? []).map((override) => [normalizeRequirementId(override.tag), override.units])
  );
  const availableItems = moduleItems.filter(
    ({ key, item }) => !allocation.claimedModuleKeys.has(key) && moduleByCode.has(item.moduleCode)
  );

  const integratedThesisUnits = rule.integratedThesisUnits ?? 0;
  const integratedEconomicsUnits = rule.integratedEconomicsUnits ?? 0;
  const integratedEconomicsLevel4000Units = rule.integratedEconomicsLevel4000Units ?? 0;
  const integratedThesisItems = takeCreditedIndustryItems(
    availableItems,
    integratedThesisTags,
    integratedThesisUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const integratedEconomicsItems = takePrioritizedTaggedItems(
    availableItems,
    economicsElectiveTags,
    economicsLevel4000Tags,
    integratedEconomicsUnits,
    integratedEconomicsLevel4000Units,
    moduleRequirementTags
  );
  const integratedThesisCreditedUnits = Math.min(
    sumCreditedIndustryUnits(integratedThesisItems),
    integratedThesisUnits
  );
  const integratedEconomicsCreditedUnits = Math.min(
    sumCreditedIndustryUnits(integratedEconomicsItems),
    integratedEconomicsUnits
  );
  const integratedEconomicsLevel4000CreditedUnits = Math.min(
    sumTaggedCreditedUnits(
      integratedEconomicsItems,
      economicsLevel4000Tags,
      moduleRequirementTags
    ),
    integratedEconomicsLevel4000Units
  );
  const integratedComplete = integratedThesisCreditedUnits >= integratedThesisUnits
    && integratedEconomicsCreditedUnits >= integratedEconomicsUnits
    && integratedEconomicsLevel4000CreditedUnits >= integratedEconomicsLevel4000Units;
  const integratedPathway: DdpHonoursPathway = {
    kind: "integrated-thesis",
    items: [...integratedThesisItems, ...integratedEconomicsItems],
    completedUnits: integratedThesisCreditedUnits + integratedEconomicsCreditedUnits,
    requiredUnits: rule.requiredUnits ?? 0,
    economicsUnits: integratedEconomicsCreditedUnits,
    requiredEconomicsUnits: integratedEconomicsUnits,
    economicsLevel4000Units: integratedEconomicsLevel4000CreditedUnits,
    requiredEconomicsLevel4000Units: integratedEconomicsLevel4000Units,
    thesisOrIndustryUnits: integratedThesisCreditedUnits,
    requiredThesisOrIndustryUnits: integratedThesisUnits,
    complete: integratedComplete,
    score: averageCompletionRatio([
      [integratedThesisCreditedUnits, integratedThesisUnits],
      [integratedEconomicsCreditedUnits, integratedEconomicsUnits],
      [integratedEconomicsLevel4000CreditedUnits, integratedEconomicsLevel4000Units]
    ])
  };

  const requiredFoundationUnits = rule.requiredFoundationUnits ?? 0;
  const requiredCompanionUnits = rule.requiredCompanionUnits ?? 0;
  const requiredIndustryUnits = requiredFoundationUnits + requiredCompanionUnits;
  const directIndustryItems = takeCreditedIndustryItems(
    availableItems,
    industryTags,
    requiredIndustryUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const foundationItems = takeCreditedIndustryItems(
    availableItems,
    foundationTags,
    requiredFoundationUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const companionItems = takeCreditedIndustryItems(
    availableItems.filter((candidate) =>
      !foundationItems.some(({ orderedItem }) => orderedItem.key === candidate.key)
    ),
    companionTags,
    requiredCompanionUnits,
    moduleRequirementTags,
    tagUnitOverrides
  );
  const foundationUnits = Math.min(sumCreditedIndustryUnits(foundationItems), requiredFoundationUnits);
  const companionUnits = Math.min(sumCreditedIndustryUnits(companionItems), requiredCompanionUnits);
  const directIndustryUnits = Math.min(sumCreditedIndustryUnits(directIndustryItems), requiredIndustryUnits);
  const internshipIndustryPathways = [
    {
      items: directIndustryItems,
      units: directIndustryUnits,
      complete: directIndustryUnits >= requiredIndustryUnits
    },
    {
      items: [...foundationItems, ...companionItems],
      units: foundationUnits + companionUnits,
      complete: foundationUnits >= requiredFoundationUnits && companionUnits >= requiredCompanionUnits
    }
  ];
  const internshipIndustryPathway = internshipIndustryPathways.sort((left, right) =>
    Number(right.complete) - Number(left.complete) || right.units - left.units
  )[0]!;
  const internshipEconomicsUnits = rule.internshipEconomicsUnits ?? 0;
  const internshipEconomicsLevel4000Units = rule.internshipEconomicsLevel4000Units ?? 0;
  const internshipEconomicsItems = takePrioritizedTaggedItems(
    availableItems,
    economicsElectiveTags,
    economicsLevel4000Tags,
    internshipEconomicsUnits,
    internshipEconomicsLevel4000Units,
    moduleRequirementTags
  );
  const internshipEconomicsCreditedUnits = Math.min(
    sumCreditedIndustryUnits(internshipEconomicsItems),
    internshipEconomicsUnits
  );
  const internshipEconomicsLevel4000CreditedUnits = Math.min(
    sumTaggedCreditedUnits(
      internshipEconomicsItems,
      economicsLevel4000Tags,
      moduleRequirementTags
    ),
    internshipEconomicsLevel4000Units
  );
  const internshipComplete = internshipIndustryPathway.complete
    && internshipEconomicsCreditedUnits >= internshipEconomicsUnits
    && internshipEconomicsLevel4000CreditedUnits >= internshipEconomicsLevel4000Units;
  const internshipPathway: DdpHonoursPathway = {
    kind: "internship",
    items: [...internshipIndustryPathway.items, ...internshipEconomicsItems],
    completedUnits: internshipIndustryPathway.units + internshipEconomicsCreditedUnits,
    requiredUnits: rule.internshipPathwayRequiredUnits ?? 0,
    economicsUnits: internshipEconomicsCreditedUnits,
    requiredEconomicsUnits: internshipEconomicsUnits,
    economicsLevel4000Units: internshipEconomicsLevel4000CreditedUnits,
    requiredEconomicsLevel4000Units: internshipEconomicsLevel4000Units,
    thesisOrIndustryUnits: internshipIndustryPathway.units,
    requiredThesisOrIndustryUnits: requiredIndustryUnits,
    complete: internshipComplete,
    score: averageCompletionRatio([
      [internshipIndustryPathway.units, requiredIndustryUnits],
      [internshipEconomicsCreditedUnits, internshipEconomicsUnits],
      [internshipEconomicsLevel4000CreditedUnits, internshipEconomicsLevel4000Units]
    ])
  };

  const selectedPathway = [integratedPathway, internshipPathway].sort((left, right) =>
    Number(right.complete) - Number(left.complete) || right.score - left.score
  )[0]!;
  for (const { orderedItem, creditedUnits } of selectedPathway.items) {
    claimModuleUnits(allocation, orderedItem, creditedUnits);
  }

  const missing: string[] = [];
  if (selectedPathway.thesisOrIndustryUnits < selectedPathway.requiredThesisOrIndustryUnits) {
    const remaining = selectedPathway.requiredThesisOrIndustryUnits - selectedPathway.thesisOrIndustryUnits;
    missing.push(
      selectedPathway.kind === "integrated-thesis"
        ? `${remaining} integrated thesis units remaining`
        : `${remaining} Business Analytics Industry Experience units remaining`
    );
  }
  if (selectedPathway.economicsUnits < selectedPathway.requiredEconomicsUnits) {
    missing.push(
      `${selectedPathway.requiredEconomicsUnits - selectedPathway.economicsUnits} Economics elective units remaining`
    );
  }
  if (selectedPathway.economicsLevel4000Units < selectedPathway.requiredEconomicsLevel4000Units) {
    missing.push(
      `${selectedPathway.requiredEconomicsLevel4000Units - selectedPathway.economicsLevel4000Units} more Economics Level-4000+ units required`
    );
  }
  const warnings = selectedPathway.kind === "internship" && rule.advisory
    ? [rule.advisory]
    : [];
  const contributors = Array.from(new Set(
    selectedPathway.items
      .sort((left, right) => left.orderedItem.order - right.orderedItem.order)
      .map(({ orderedItem }) => orderedItem.item.moduleCode)
  ));

  return formatProgressWithStatus(
    rule,
    Math.min(selectedPathway.completedUnits, selectedPathway.requiredUnits),
    selectedPathway.requiredUnits,
    contributors,
    missing,
    warnings,
    selectedPathway.complete ? "fulfilled" : undefined
  );
}

function takePrioritizedTaggedItems(
  items: OrderedModuleItem[],
  acceptedTags: Set<string>,
  priorityTags: Set<string>,
  requiredUnits: number,
  requiredPriorityUnits: number,
  moduleRequirementTags: Map<string, string[]>
): CreditedIndustryItem[] {
  const eligibleItems = items.filter(({ item }) => {
    const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
    return tags.some((tag) => acceptedTags.has(tag));
  });
  const priorityItems = eligibleItems.filter(({ item }) => {
    const tags = getNormalizedModuleRequirementTags(moduleRequirementTags, item.moduleCode);
    return tags.some((tag) => priorityTags.has(tag));
  });
  const otherItems = eligibleItems.filter((candidate) =>
    !priorityItems.some((priorityItem) => priorityItem.key === candidate.key)
  );
  const selected: CreditedIndustryItem[] = [];
  let creditedUnits = 0;
  let priorityUnits = 0;

  for (const orderedItem of [...priorityItems, ...otherItems]) {
    if (creditedUnits >= requiredUnits) {
      break;
    }
    const credited = Math.min(orderedItem.item.units, requiredUnits - creditedUnits);
    selected.push({ orderedItem, creditedUnits: credited });
    creditedUnits += credited;
    if (priorityItems.some((priorityItem) => priorityItem.key === orderedItem.key)) {
      priorityUnits += credited;
    }
    if (creditedUnits >= requiredUnits && priorityUnits < requiredPriorityUnits) {
      break;
    }
  }

  return selected;
}

function sumTaggedCreditedUnits(
  items: CreditedIndustryItem[],
  acceptedTags: Set<string>,
  moduleRequirementTags: Map<string, string[]>
): number {
  return items.reduce((sum, { orderedItem, creditedUnits }) => {
    const tags = getNormalizedModuleRequirementTags(
      moduleRequirementTags,
      orderedItem.item.moduleCode
    );
    return sum + (tags.some((tag) => acceptedTags.has(tag)) ? creditedUnits : 0);
  }, 0);
}

function averageCompletionRatio(thresholds: Array<[number, number]>): number {
  return thresholds.reduce(
    (sum, [completed, required]) => sum + (required > 0 ? Math.min(completed / required, 1) : 1),
    0
  ) / thresholds.length;
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
  const completedUnits = explicitModuleItems.reduce((sum, { item }) => sum + item.units, 0)
    + overflowModuleItems.reduce(
      (sum, { key, item }) => sum + (allocation.overflowModuleUnits.get(key) ?? item.units),
      0
    )
    + placeholderContributors.reduce((sum, { item }) => sum + item.units, 0);
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

function claimModuleUnits(
  allocation: AllocationState,
  orderedItem: OrderedModuleItem,
  creditedUnits: number
): void {
  allocation.claimedModuleKeys.add(orderedItem.key);
  const overflowUnits = Math.max(orderedItem.item.units - creditedUnits, 0);
  if (overflowUnits > 0) {
    allocation.overflowModuleKeys.add(orderedItem.key);
    allocation.overflowModuleUnits.set(orderedItem.key, overflowUnits);
  }
}

function consumeAvailableModuleUnits(
  allocation: AllocationState,
  orderedItem: OrderedModuleItem,
  creditedUnits: number
): void {
  const overflowUnits = allocation.overflowModuleUnits.get(orderedItem.key);
  if (overflowUnits === undefined) {
    claimModuleUnits(allocation, orderedItem, creditedUnits);
    return;
  }

  const remainingUnits = Math.max(overflowUnits - creditedUnits, 0);
  if (remainingUnits > 0) {
    allocation.overflowModuleUnits.set(orderedItem.key, remainingUnits);
  } else {
    allocation.overflowModuleKeys.delete(orderedItem.key);
    allocation.overflowModuleUnits.delete(orderedItem.key);
  }
}

function overflowModule(allocation: AllocationState, orderedItem: OrderedModuleItem): void {
  allocation.claimedModuleKeys.add(orderedItem.key);
  allocation.overflowModuleKeys.add(orderedItem.key);
  allocation.overflowModuleUnits.set(orderedItem.key, orderedItem.item.units);
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
  const priorSemesterCodes = new Set<string>();
  const warnings: string[] = [];

  for (const semester of plan.semesters) {
    const currentSemesterCodes = new Set<string>();

    for (const item of semester.items) {
      if (item.type !== "module") {
        continue;
      }

      const module = moduleByCode.get(item.moduleCode);
      if (module && !hasSatisfiedPrerequisites(priorSemesterCodes, module)) {
        warnings.push(`${item.moduleCode}: advisory prerequisite note - ${module.prerequisite ?? "prerequisites not met"}`);
      }

      currentSemesterCodes.add(item.moduleCode);
    }

    for (const moduleCode of currentSemesterCodes) {
      priorSemesterCodes.add(moduleCode);
    }
  }

  return warnings;
}

export function getDuplicateModuleWarnings(plan: Plan): string[] {
  const firstSeenSemesterByModuleCode = new Map<string, string>();
  const warnings: string[] = [];

  for (const semester of plan.semesters) {
    for (const item of semester.items) {
      if (item.type !== "module") {
        continue;
      }

      const firstSeenSemester = firstSeenSemesterByModuleCode.get(item.moduleCode);
      if (firstSeenSemester) {
        warnings.push(`This module ${item.moduleCode} is a duplicate module from ${firstSeenSemester}.`);
        continue;
      }

      firstSeenSemesterByModuleCode.set(item.moduleCode, semester.label);
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
