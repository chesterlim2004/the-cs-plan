import { Types } from "mongoose";
import {
  PlanExportSchema,
  PlanSchema,
  StudentProfileSchema,
  type Cohort,
  type Plan,
  type PlanExport,
  type Programme
} from "@the-cs-plan/shared";
import { evaluatePlan, getDuplicateModuleWarnings, getPrerequisiteWarnings } from "@the-cs-plan/rules-engine";
import { PlanModel } from "../models/Plan.js";
import { StudentProfileModel } from "../models/StudentProfile.js";
import { getAllModules } from "./moduleService.js";
import { getModuleRequirementTagLookup } from "./moduleRequirementTagService.js";
import { getRequirementSet } from "./requirementService.js";

export function serializePlan(document: { _id?: unknown; name: string; programme: Programme; cohort: Cohort; semesters: unknown[] }): Plan {
  return PlanSchema.parse({
    id: document._id?.toString(),
    name: document.name,
    programme: document.programme,
    cohort: document.cohort,
    semesters: document.semesters
  });
}

export async function listPlans(userId: string): Promise<Plan[]> {
  const plans = await PlanModel.find({ userId }).sort({ updatedAt: -1 }).lean();
  return plans.map(serializePlan);
}

export async function createPlan(userId: string, input: Plan): Promise<Plan> {
  const parsed = PlanSchema.parse(input);
  const plan = await PlanModel.create({
    userId: new Types.ObjectId(userId),
    name: parsed.name,
    programme: parsed.programme,
    cohort: parsed.cohort,
    semesters: parsed.semesters
  });
  return serializePlan(plan);
}

export async function getOwnedPlan(userId: string, planId: string): Promise<Plan | null> {
  if (!Types.ObjectId.isValid(planId)) {
    return null;
  }

  const plan = await PlanModel.findOne({ _id: planId, userId }).lean();
  return plan ? serializePlan(plan) : null;
}

export async function updateOwnedPlan(userId: string, planId: string, input: Plan): Promise<Plan | null> {
  if (!Types.ObjectId.isValid(planId)) {
    return null;
  }

  const parsed = PlanSchema.parse(input);
  const plan = await PlanModel.findOneAndUpdate(
    { _id: planId, userId },
    {
      name: parsed.name,
      programme: parsed.programme,
      cohort: parsed.cohort,
      semesters: parsed.semesters
    },
    { new: true }
  ).lean();

  return plan ? serializePlan(plan) : null;
}

export async function deleteOwnedPlan(userId: string, planId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(planId)) {
    return false;
  }

  const result = await PlanModel.deleteOne({ _id: planId, userId });
  return result.deletedCount === 1;
}

export async function evaluateOwnedPlan(userId: string, planId: string) {
  const plan = await getOwnedPlan(userId, planId);
  if (!plan) {
    return null;
  }

  const modules = await getAllModules();
  const requirementSet = await getRequirementSet(plan.programme, plan.cohort);
  const moduleRequirementTags = await getModuleRequirementTagLookup(plan.programme, plan.cohort);
  const result = evaluatePlan(requirementSet, plan, modules, moduleRequirementTags);
  return {
    ...result,
    warnings: [...result.warnings, ...getPrerequisiteWarnings(plan, modules), ...getDuplicateModuleWarnings(plan)]
  };
}

export async function exportOwnedPlan(userId: string, planId: string): Promise<PlanExport | null> {
  const plan = await getOwnedPlan(userId, planId);
  const profile = await StudentProfileModel.findOne({ userId }).lean();
  if (!plan || !profile) {
    return null;
  }

  return PlanExportSchema.parse({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: StudentProfileSchema.parse({
      programme: profile.programme,
      cohort: profile.cohort,
      startingSemester: profile.startingSemester ?? "Y1S1",
      currentSemester: profile.currentSemester ?? profile.startingSemester ?? "Y1S1",
      graduationSemester: profile.graduationSemester,
      primaryPlanId: profile.primaryPlanId?.toString(),
      planOrder: (profile.planOrder ?? []).map((planId) => planId.toString())
    }),
    plan: { ...plan, id: undefined }
  });
}

export async function importPlan(userId: string, input: unknown): Promise<Plan> {
  const parsed = PlanExportSchema.parse(input);
  return createPlan(userId, {
    ...parsed.plan,
    id: undefined,
    name: `${parsed.plan.name} (Imported)`
  });
}
