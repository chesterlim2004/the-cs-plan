import { Types } from "mongoose";
import {
  createSemestersUntil,
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

  let plan = await PlanModel.findOne({ userId: userObjectId, name: "Primary Plan" });
  if (!plan) {
    plan = await PlanModel.create({
      userId: userObjectId,
      name: "Primary Plan",
      programme: parsed.programme,
      cohort: parsed.cohort,
      semesters: createSemestersUntil(parsed.graduationSemester)
    });
  }

  const userPlans = await PlanModel.find({ userId: userObjectId });
  await Promise.all(
    userPlans.map((userPlan) => {
      userPlan.programme = parsed.programme;
      userPlan.cohort = parsed.cohort;
      userPlan.semesters = reconcileSemesters(userPlan.semesters as SemesterPlan[], parsed.graduationSemester);
      return userPlan.save();
    })
  );

  return StudentProfileModel.findOneAndUpdate(
    { userId: userObjectId },
    {
      ...parsed,
      userId: userObjectId,
      primaryPlanId: plan._id
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}


function reconcileSemesters(existingSemesters: SemesterPlan[], graduationSemester: StudentProfile["graduationSemester"]) {
  const existingByKey = new Map(existingSemesters.map((semester) => [semester.key, semester]));
  return createSemestersUntil(graduationSemester).map((semester) => ({
    ...semester,
    items: existingByKey.get(semester.key)?.items ?? []
  }));
}
