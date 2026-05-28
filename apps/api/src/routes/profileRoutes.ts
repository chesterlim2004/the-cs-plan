import { Router } from "express";
import { StudentProfileSchema } from "@the-cs-plan/shared";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { getProfile, upsertProfile } from "../services/profileService.js";

export const profileRoutes = Router();

profileRoutes.get("/", requireAuth, async (request, response, next) => {
  try {
    const profile = await getProfile(request.user!.id);
    response.json(
      profile
        ? {
            programme: profile.programme,
            cohort: profile.cohort,
            startingSemester: profile.startingSemester ?? "Y1S1",
            graduationSemester: profile.graduationSemester,
            primaryPlanId: profile.primaryPlanId?.toString()
          }
        : null
    );
  } catch (error) {
    next(error);
  }
});

profileRoutes.put(
  "/",
  requireAuth,
  validateBody(StudentProfileSchema),
  async (request, response, next) => {
    try {
      const profile = await upsertProfile(request.user!.id, request.body);
      response.json({
        programme: profile.programme,
        cohort: profile.cohort,
        startingSemester: profile.startingSemester,
        graduationSemester: profile.graduationSemester,
        primaryPlanId: profile.primaryPlanId?.toString()
      });
    } catch (error) {
      next(error);
    }
  }
);
