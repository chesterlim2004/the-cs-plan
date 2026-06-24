import { Types } from "mongoose";
import {
  createSemestersForRange,
  StudentProfileSchema,
  type SemesterPlan,
  type StudentProfile
} from "@the-cs-plan/shared";
import { PlanModel } from "../models/Plan.js";
import { StudentProfileModel } from "../models/StudentProfile.js";

export async function getProfile(userId: string) {
  return StudentProfileModel.findOne({ userId }).lean();
}

export async function upsertProfile(userId: string, input: StudentProfile) {
  const parsed = StudentProfileSchema.parse(input);
  const userObjectId = new Types.ObjectId(userId);

  let userPlans = await PlanModel.find({ userId: userObjectId });
  let fallbackPrimaryPlan = userPlans.find((userPlan) => userPlan.name === "Primary Plan") ?? userPlans[0];
  if (!fallbackPrimaryPlan) {
    fallbackPrimaryPlan = await PlanModel.create({
      userId: userObjectId,
      name: "Primary Plan",
      programme: parsed.programme,
      cohort: parsed.cohort,
      semesters: createSemestersForRange(parsed.startingSemester, parsed.graduationSemester)
    });
    userPlans = [fallbackPrimaryPlan];
  }

  await Promise.all(
    userPlans.map((userPlan) => {
      userPlan.programme = parsed.programme;
      userPlan.cohort = parsed.cohort;
      userPlan.semesters = reconcileSemesters(
        userPlan.semesters as SemesterPlan[],
        parsed.startingSemester,
        parsed.graduationSemester
      );
      return userPlan.save();
    })
  );

  const requestedPrimaryPlan =
    parsed.primaryPlanId && Types.ObjectId.isValid(parsed.primaryPlanId)
      ? await PlanModel.findOne({ _id: parsed.primaryPlanId, userId: userObjectId })
      : null;
  const ownedPlanIds = new Set(userPlans.map((userPlan) => userPlan._id.toString()));
  const sanitizedPlanOrder = parsed.planOrder
    .filter((planId, index, planOrder) => ownedPlanIds.has(planId) && planOrder.indexOf(planId) === index)
    .map((planId) => new Types.ObjectId(planId));

  return StudentProfileModel.findOneAndUpdate(
    { userId: userObjectId },
    {
      ...parsed,
      userId: userObjectId,
      primaryPlanId: requestedPrimaryPlan?._id ?? fallbackPrimaryPlan._id,
      planOrder: sanitizedPlanOrder
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}


function reconcileSemesters(
  existingSemesters: SemesterPlan[],
  startingSemester: StudentProfile["startingSemester"],
  graduationSemester: StudentProfile["graduationSemester"]
) {
  const existingByKey = new Map(existingSemesters.map((semester) => [semester.key, semester]));
  return createSemestersForRange(startingSemester, graduationSemester).map((semester) => ({
    ...semester,
    items: existingByKey.get(semester.key)?.items ?? []
  }));
}
