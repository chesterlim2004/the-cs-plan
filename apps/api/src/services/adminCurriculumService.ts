import mongoose from "mongoose";
import { evaluatePlan } from "@the-cs-plan/rules-engine";
import {
  AdminCloneCurriculumSchema,
  AdminCurriculumDraftSchema,
  RequirementSetSchema,
  type AdminCloneCurriculum,
  type AdminCurriculumDraft,
  type Cohort,
  type Module,
  type ModuleRequirementTags,
  type Plan,
  type Programme,
  type RequirementRule,
  type RequirementSet
} from "@the-cs-plan/shared";
import { HttpError } from "../lib/HttpError.js";
import { ModuleModel } from "../models/Module.js";
import { ModuleRequirementTagsModel } from "../models/ModuleRequirementTags.js";
import { PlanModel } from "../models/Plan.js";
import { RequirementSetModel } from "../models/RequirementSet.js";
import { serializePlan } from "./planService.js";

const samplePlanLimit = 5;

export interface CurriculumCatalogItem {
  programme: Programme;
  cohort: Cohort;
  latestVersion: number;
  versionCount: number;
  totalUnits: number;
  sourceNote: string;
  ruleCount: number;
  tagCount: number;
  updatedAt: string;
}

export interface AdminValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    ruleCount: number;
    mappedModuleCount: number;
    stagedTagChangeCount: number;
    samplePlansEvaluated: number;
  };
  samplePlans: Array<{
    sample: number;
    fulfilledRules: number;
    totalRules: number;
    completedUnits: number;
    warningCount: number;
  }>;
}

export async function listAdminCurricula(): Promise<CurriculumCatalogItem[]> {
  const [requirementSets, tagCounts] = await Promise.all([
    RequirementSetModel.find().sort({ programme: 1, cohort: 1, version: -1 }).lean(),
    ModuleRequirementTagsModel.aggregate<{
      _id: { programme: Programme; cohort: Cohort };
      count: number;
    }>([
      { $group: { _id: { programme: "$programme", cohort: "$cohort" }, count: { $sum: 1 } } }
    ])
  ]);
  const tagCountByCurriculum = new Map(
    tagCounts.map((item) => [`${item._id.programme}:${item._id.cohort}`, item.count])
  );
  const grouped = new Map<string, CurriculumCatalogItem>();

  for (const requirementSet of requirementSets) {
    const key = `${requirementSet.programme}:${requirementSet.cohort}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.versionCount += 1;
      continue;
    }

    grouped.set(key, {
      programme: requirementSet.programme,
      cohort: requirementSet.cohort,
      latestVersion: requirementSet.version,
      versionCount: 1,
      totalUnits: requirementSet.totalUnits,
      sourceNote: requirementSet.sourceNote,
      ruleCount: requirementSet.rules.length,
      tagCount: tagCountByCurriculum.get(key) ?? 0,
      updatedAt: requirementSet.updatedAt.toISOString()
    });
  }

  return Array.from(grouped.values());
}

export async function getAdminCurriculum(
  programme: Programme,
  cohort: Cohort
): Promise<RequirementSet | null> {
  const requirementSet = await RequirementSetModel.findOne({ programme, cohort })
    .sort({ version: -1 })
    .lean();
  return requirementSet ? RequirementSetSchema.parse(requirementSet) : null;
}

export async function listAdminCurriculumModuleTags(
  programme: Programme,
  cohort: Cohort
) {
  const tags = await ModuleRequirementTagsModel.aggregate<{
    _id: string;
    moduleCodes: string[];
  }>([
    { $match: { programme, cohort } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", moduleCodes: { $addToSet: "$moduleCode" } } },
    { $sort: { _id: 1 } }
  ]);

  return {
    tags: tags.map(({ _id, moduleCodes }) => ({
      tag: _id,
      moduleCodes: [...moduleCodes].sort()
    }))
  };
}

export async function searchAdminModuleTags(
  programme: Programme,
  cohort: Cohort,
  query: string,
  page: number,
  tag: string
) {
  const normalizedQuery = query.trim();
  const normalizedTag = tag.trim().toLowerCase();
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  if (normalizedQuery) {
    const regex = new RegExp(escapeRegExp(normalizedQuery), "i");
    const taggedModuleCodes = normalizedTag
      ? await ModuleRequirementTagsModel.distinct("moduleCode", {
          programme,
          cohort,
          tags: normalizedTag
        })
      : null;
    const [result] = await ModuleModel.aggregate<{
      metadata: Array<{ total: number }>;
      rows: Array<{ moduleCode: string; title: string; acadYear?: string }>;
    }>([
      {
        $match: {
          $or: [{ moduleCode: regex }, { title: regex }],
          ...(taggedModuleCodes ? { moduleCode: { $in: taggedModuleCodes } } : {})
        }
      },
      { $sort: { acadYear: -1, moduleCode: 1 } },
      {
        $group: {
          _id: "$moduleCode",
          moduleCode: { $first: "$moduleCode" },
          title: { $first: "$title" },
          acadYear: { $first: "$acadYear" }
        }
      },
      { $sort: { moduleCode: 1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          rows: [{ $skip: offset }, { $limit: pageSize }]
        }
      }
    ]);
    const modules = result?.rows ?? [];
    const total = result?.metadata[0]?.total ?? 0;
    const mappings = await ModuleRequirementTagsModel.find({
      programme,
      cohort,
      moduleCode: { $in: modules.map((module) => module.moduleCode) }
    }).lean<ModuleRequirementTags[]>();
    const mappingByCode = new Map(mappings.map((mapping) => [mapping.moduleCode, mapping.tags]));

    return {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      rows: modules.map((module) => ({
        moduleCode: module.moduleCode,
        title: module.title,
        acadYear: module.acadYear,
        tags: mappingByCode.get(module.moduleCode) ?? []
      }))
    };
  }

  const mappingFilter = {
    programme,
    cohort,
    ...(normalizedTag ? { tags: normalizedTag } : {})
  };
  const [mappings, total] = await Promise.all([
    ModuleRequirementTagsModel.find(mappingFilter)
      .sort({ moduleCode: 1 })
      .skip(offset)
      .limit(pageSize)
      .lean<ModuleRequirementTags[]>(),
    ModuleRequirementTagsModel.countDocuments(mappingFilter)
  ]);
  const modules = await ModuleModel.find({
    moduleCode: { $in: mappings.map((mapping) => mapping.moduleCode) }
  })
    .sort({ acadYear: -1 })
    .lean();
  const moduleByCode = new Map(modules.map((module) => [module.moduleCode, module]));

  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    rows: mappings.map((mapping) => ({
      moduleCode: mapping.moduleCode,
      title: moduleByCode.get(mapping.moduleCode)?.title ?? "Module not found in current catalogue",
      acadYear: moduleByCode.get(mapping.moduleCode)?.acadYear,
      tags: mapping.tags
    }))
  };
}

export async function validateAdminCurriculumDraft(
  input: AdminCurriculumDraft
): Promise<AdminValidationResult> {
  const draft = AdminCurriculumDraftSchema.parse(input);
  const [modules, storedMappings, samplePlanDocuments, latestRequirementSet] = await Promise.all([
    ModuleModel.find().lean(),
    ModuleRequirementTagsModel.find({ programme: draft.programme, cohort: draft.cohort })
      .lean<ModuleRequirementTags[]>(),
    PlanModel.find({ programme: draft.programme, cohort: draft.cohort })
      .sort({ updatedAt: -1 })
      .limit(samplePlanLimit)
      .lean(),
    RequirementSetModel.findOne({ programme: draft.programme, cohort: draft.cohort })
      .sort({ version: -1 })
      .lean()
  ]);
  const moduleCodes = new Set(modules.map((module) => module.moduleCode));
  const errors = validateDraftSemantics(draft, moduleCodes);
  const warnings: string[] = [];

  if ((latestRequirementSet?.version ?? 0) !== draft.baseVersion) {
    errors.push(
      `This draft is based on version ${draft.baseVersion}, but version ${latestRequirementSet?.version ?? 0} is currently published. Reload before publishing.`
    );
  }

  const mappingByCode = new Map(storedMappings.map((mapping) => [mapping.moduleCode, mapping.tags]));
  for (const change of draft.tagChanges) {
    mappingByCode.set(change.moduleCode, change.tags);
  }
  const referencedTags = getReferencedTags(draft.rules);
  const mappedTags = new Set(Array.from(mappingByCode.values()).flat());
  for (const tag of referencedTags) {
    if (!mappedTags.has(tag)) {
      warnings.push(`No module is currently mapped to the referenced tag "${tag}".`);
    }
  }

  const declaredUnits = draft.rules.reduce((sum, rule) => sum + getRuleRequiredUnits(rule), 0);
  if (declaredUnits !== draft.totalUnits) {
    warnings.push(
      `The rules declare ${declaredUnits} units in total, while the requirement set target is ${draft.totalUnits} units.`
    );
  }

  if (samplePlanDocuments.length === 0) {
    warnings.push("No saved plans match this programme and cohort, so plan regression preview could not run.");
  }

  const requirementSet = RequirementSetSchema.parse({
    programme: draft.programme,
    cohort: draft.cohort,
    version: draft.baseVersion + 1,
    totalUnits: draft.totalUnits,
    sourceNote: draft.sourceNote,
    rules: draft.rules
  });
  const samplePlans = errors.length === 0
    ? samplePlanDocuments.map((document, index) =>
        evaluateSamplePlan(requirementSet, serializePlan(document), modules, mappingByCode, index)
      )
    : [];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      ruleCount: draft.rules.length,
      mappedModuleCount: mappingByCode.size,
      stagedTagChangeCount: draft.tagChanges.length,
      samplePlansEvaluated: samplePlans.length
    },
    samplePlans
  };
}

export async function publishAdminCurriculumDraft(
  input: AdminCurriculumDraft
): Promise<{ requirementSet: RequirementSet; validation: AdminValidationResult }> {
  const draft = AdminCurriculumDraftSchema.parse(input);
  const validation = await validateAdminCurriculumDraft(draft);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors.join(" "));
  }

  const session = await mongoose.startSession();
  let published: RequirementSet | undefined;
  try {
    await session.withTransaction(async () => {
      const latest = await RequirementSetModel.findOne({
        programme: draft.programme,
        cohort: draft.cohort
      })
        .sort({ version: -1 })
        .session(session)
        .lean();
      const latestVersion = latest?.version ?? 0;
      if (latestVersion !== draft.baseVersion) {
        throw new HttpError(409, `Version ${latestVersion} is now published. Reload and validate the draft again.`);
      }

      const requirementSet = RequirementSetSchema.parse({
        programme: draft.programme,
        cohort: draft.cohort,
        version: latestVersion + 1,
        totalUnits: draft.totalUnits,
        sourceNote: draft.sourceNote,
        rules: draft.rules
      });
      const [created] = await RequirementSetModel.create([requirementSet], { session });
      if (!created) {
        throw new Error("Requirement set was not created");
      }

      if (draft.tagChanges.length > 0) {
        await ModuleRequirementTagsModel.bulkWrite(
          draft.tagChanges.map((change) => ({
            updateOne: {
              filter: {
                programme: draft.programme,
                cohort: draft.cohort,
                moduleCode: change.moduleCode
              },
              update: {
                $set: {
                  programme: draft.programme,
                  cohort: draft.cohort,
                  moduleCode: change.moduleCode,
                  tags: change.tags
                }
              },
              upsert: true
            }
          })),
          { session }
        );
      }

      published = RequirementSetSchema.parse(created.toObject());
    });
  } finally {
    await session.endSession();
  }

  if (!published) {
    throw new Error("Curriculum publish transaction did not complete");
  }

  return { requirementSet: published, validation };
}

export async function previewCurriculumClone(input: AdminCloneCurriculum) {
  const clone = AdminCloneCurriculumSchema.parse(input);
  const [source, sourceTags, target, targetTagCount, modules] = await Promise.all([
    getAdminCurriculum(clone.sourceProgramme, clone.sourceCohort),
    ModuleRequirementTagsModel.find({
      programme: clone.sourceProgramme,
      cohort: clone.sourceCohort
    }).lean<ModuleRequirementTags[]>(),
    getAdminCurriculum(clone.targetProgramme, clone.targetCohort),
    ModuleRequirementTagsModel.countDocuments({
      programme: clone.targetProgramme,
      cohort: clone.targetCohort
    }),
    ModuleModel.find({}, { moduleCode: 1 }).lean()
  ]);

  if (!source) {
    throw new HttpError(404, "Source curriculum not found");
  }

  const cloneDraft: AdminCurriculumDraft = {
    programme: clone.targetProgramme,
    cohort: clone.targetCohort,
    baseVersion: 0,
    totalUnits: source.totalUnits,
    sourceNote: source.sourceNote,
    rules: source.rules,
    tagChanges: []
  };
  const knownModuleCodes = new Set(modules.map((module) => module.moduleCode));
  const validationErrors = validateDraftSemantics(cloneDraft, knownModuleCodes, {
    allowUnknownRuleModules: true
  });
  const missingModuleWarnings = source.rules.flatMap((rule) =>
    getRuleModuleCodes(rule)
      .filter((moduleCode) => !knownModuleCodes.has(moduleCode))
      .map(
        (moduleCode) =>
          `Rule "${rule.id}" references module ${moduleCode}, which is not in the current module catalogue. The reference will be retained in the cloned ruleset.`
      )
  );
  const referencedTags = getReferencedTags(source.rules);
  const mappedTags = new Set(sourceTags.flatMap((mapping) => mapping.tags));
  const validationWarnings = Array.from(referencedTags)
    .filter((tag) => !mappedTags.has(tag))
    .map((tag) => `No source module is mapped to the referenced tag "${tag}".`);
  const conflicts = [
    ...(target ? [`Target already has requirement-set version ${target.version}.`] : []),
    ...(targetTagCount > 0 ? [`Target already has ${targetTagCount} module tag mappings.`] : []),
    ...validationErrors
  ];

  return {
    source: {
      programme: source.programme,
      cohort: source.cohort,
      version: source.version,
      totalUnits: source.totalUnits,
      ruleCount: source.rules.length,
      tagCount: sourceTags.length,
      sourceNote: source.sourceNote
    },
    target: {
      programme: clone.targetProgramme,
      cohort: clone.targetCohort,
      version: 1
    },
    canClone: conflicts.length === 0,
    conflicts,
    warnings: [...missingModuleWarnings, ...validationWarnings]
  };
}

export async function cloneAdminCurriculum(input: AdminCloneCurriculum) {
  const clone = AdminCloneCurriculumSchema.parse(input);
  const preview = await previewCurriculumClone(clone);
  if (!preview.canClone) {
    throw new HttpError(409, preview.conflicts.join(" "));
  }

  const [source, sourceTags] = await Promise.all([
    getAdminCurriculum(clone.sourceProgramme, clone.sourceCohort),
    ModuleRequirementTagsModel.find({
      programme: clone.sourceProgramme,
      cohort: clone.sourceCohort
    }).lean<ModuleRequirementTags[]>()
  ]);
  if (!source) {
    throw new HttpError(404, "Source curriculum not found");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const targetExists = await RequirementSetModel.exists({
        programme: clone.targetProgramme,
        cohort: clone.targetCohort
      }).session(session);
      if (targetExists) {
        throw new HttpError(409, "Target curriculum was created by another administrator. Reload and try again.");
      }

      await RequirementSetModel.create([{
        ...source,
        programme: clone.targetProgramme,
        cohort: clone.targetCohort,
        version: 1
      }], { session });

      if (sourceTags.length > 0) {
        await ModuleRequirementTagsModel.bulkWrite(
          sourceTags.map((mapping) => ({
            insertOne: {
              document: {
                programme: clone.targetProgramme,
                cohort: clone.targetCohort,
                moduleCode: mapping.moduleCode,
                tags: mapping.tags
              }
            }
          })),
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    requirementSet: RequirementSetSchema.parse({
      ...source,
      programme: clone.targetProgramme,
      cohort: clone.targetCohort,
      version: 1
    }),
    copiedTagCount: sourceTags.length
  };
}

export function validateDraftSemantics(
  draft: AdminCurriculumDraft,
  knownModuleCodes: Set<string>,
  options: { allowUnknownRuleModules?: boolean } = {}
): string[] {
  const errors: string[] = [];
  const ruleIds = new Set<string>();
  const changedModuleCodes = new Set<string>();

  for (const rule of draft.rules) {
    if (ruleIds.has(rule.id)) {
      errors.push(`Requirement rule id "${rule.id}" is duplicated.`);
    }
    ruleIds.add(rule.id);
    validateRuleFields(rule, errors);

    for (const moduleCode of getRuleModuleCodes(rule)) {
      if (!knownModuleCodes.has(moduleCode) && !options.allowUnknownRuleModules) {
        errors.push(`Rule "${rule.id}" references unknown module ${moduleCode}.`);
      }
    }
  }

  for (const change of draft.tagChanges) {
    if (changedModuleCodes.has(change.moduleCode)) {
      errors.push(`Module tag change for ${change.moduleCode} is duplicated.`);
    }
    changedModuleCodes.add(change.moduleCode);
    if (!knownModuleCodes.has(change.moduleCode)) {
      errors.push(`Cannot tag unknown module ${change.moduleCode}.`);
    }
  }

  return Array.from(new Set(errors));
}

function validateRuleFields(rule: RequirementRule, errors: string[]) {
  const requireUnits = () => {
    if (rule.requiredUnits === undefined) {
      errors.push(`Rule "${rule.id}" requires requiredUnits.`);
    }
  };
  const requireTags = () => {
    if (!rule.acceptedTags?.length) {
      errors.push(`Rule "${rule.id}" requires at least one accepted tag.`);
    }
  };

  if (rule.type === "module-list" && !rule.requiredModules?.length) {
    errors.push(`Rule "${rule.id}" requires at least one required module.`);
  }
  if (rule.type === "module-choice") {
    requireUnits();
    if (!rule.moduleOptions?.length || rule.moduleOptions.some((option) => option.length === 0)) {
      errors.push(`Rule "${rule.id}" requires at least one non-empty module option.`);
    }
  }
  if (["units-from-tags", "capped-units-from-tags", "combined-units", "residual-units"].includes(rule.type)) {
    requireUnits();
    requireTags();
  }
  if (rule.type === "placeholder-units") {
    requireUnits();
    if (!rule.acceptedPlaceholders?.length) {
      errors.push(`Rule "${rule.id}" requires at least one accepted placeholder.`);
    }
  }
  if (rule.type === "structured-idcd") {
    requireUnits();
    if (!rule.idTags?.length || !rule.cdTags?.length) {
      errors.push(`Rule "${rule.id}" requires both idTags and cdTags.`);
    }
  }
  if (rule.type === "structured-breadth-depth") {
    requireUnits();
    requireTags();
    if (!rule.focusAreas?.length) {
      errors.push(`Rule "${rule.id}" requires at least one focus area.`);
    }
  }
  if (rule.type === "structured-programme-electives") {
    requireUnits();
    requireTags();
    if (rule.requiredMinCourses === undefined) {
      errors.push(`Rule "${rule.id}" requires requiredMinCourses.`);
    }
    if (!rule.requiredPrefixes?.length && (rule.requiredPrefixMinCourses ?? 0) > 0) {
      errors.push(`Rule "${rule.id}" requires at least one required prefix.`);
    }
  }
  if (rule.type === "structured-industry-experience") {
    requireUnits();
    if (!rule.industryTags?.length && !rule.dissertationTags?.length) {
      errors.push(`Rule "${rule.id}" requires an industry or dissertation completion tag.`);
    }
    if (
      (rule.internshipFoundationTags?.length ?? 0) > 0
      && !(rule.secondInternshipTags?.length || rule.supplementaryTags?.length)
    ) {
      errors.push(`Rule "${rule.id}" requires a second-internship or supplementary tag.`);
    }
    if (
      (rule.internshipFoundationTags?.length ?? 0) > 0
      && (rule.requiredFoundationUnits === undefined || rule.requiredCompanionUnits === undefined)
    ) {
      errors.push(`Rule "${rule.id}" requires foundation and companion unit thresholds.`);
    }
  }
  if (rule.type === "structured-ddp-honours-pathway") {
    requireUnits();
    if (!rule.integratedThesisTags?.length) {
      errors.push(`Rule "${rule.id}" requires at least one integrated thesis tag.`);
    }
    if (!rule.economicsElectiveTags?.length || !rule.economicsLevel4000Tags?.length) {
      errors.push(`Rule "${rule.id}" requires Economics elective and Level-4000 tags.`);
    }
    if (!rule.industryTags?.length && !rule.internshipFoundationTags?.length) {
      errors.push(`Rule "${rule.id}" requires an industry internship pathway.`);
    }
    if (
      rule.integratedThesisUnits === undefined
      || rule.integratedEconomicsUnits === undefined
      || rule.integratedEconomicsLevel4000Units === undefined
      || rule.requiredFoundationUnits === undefined
      || rule.requiredCompanionUnits === undefined
      || rule.internshipEconomicsUnits === undefined
      || rule.internshipEconomicsLevel4000Units === undefined
      || rule.internshipPathwayRequiredUnits === undefined
    ) {
      errors.push(`Rule "${rule.id}" requires all integrated-thesis and internship unit thresholds.`);
    }
  }
}

function getRuleModuleCodes(rule: RequirementRule): string[] {
  return Array.from(new Set([
    ...(rule.requiredModules ?? []),
    ...(rule.moduleOptions ?? []).flat(),
    ...(rule.focusAreas ?? []).flatMap((area) => [...area.primaryModules, ...area.electiveModules])
  ]));
}

function getReferencedTags(rules: RequirementRule[]): Set<string> {
  return new Set(rules.flatMap((rule) => [
    ...(rule.acceptedTags ?? []),
    ...(rule.idTags ?? []),
    ...(rule.cdTags ?? []),
    ...(rule.industryTags ?? []),
    ...(rule.dissertationTags ?? []),
    ...(rule.internshipFoundationTags ?? []),
    ...(rule.secondInternshipTags ?? []),
    ...(rule.supplementaryTags ?? []),
    ...(rule.integratedThesisTags ?? []),
    ...(rule.economicsElectiveTags ?? []),
    ...(rule.economicsLevel4000Tags ?? []),
    ...(rule.tagUnitOverrides ?? []).map((override) => override.tag),
    ...(rule.tagCaps ?? []).map((cap) => cap.tag)
  ]));
}

function getRuleRequiredUnits(rule: RequirementRule): number {
  return rule.requiredUnits ?? (rule.requiredModules?.length ?? 0) * 4;
}

function evaluateSamplePlan(
  requirementSet: RequirementSet,
  plan: Plan,
  modules: Module[],
  mappingByCode: Map<string, string[]>,
  index: number
) {
  const result = evaluatePlan(requirementSet, plan, modules, mappingByCode);
  return {
    sample: index + 1,
    fulfilledRules: result.requirements.filter((requirement) => requirement.status === "fulfilled").length,
    totalRules: result.requirements.length,
    completedUnits: result.totalCompletedUnits,
    warningCount: result.warnings.length + result.requirements.reduce(
      (sum, requirement) => sum + requirement.warnings.length,
      0
    )
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
