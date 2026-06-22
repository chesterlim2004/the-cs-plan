import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getProfile } from "../services/profileService.js";

export const meRoutes = Router();

meRoutes.get("/", requireAuth, async (request, response, next) => {
  try {
    const profile = await getProfile(request.user!.id);
    response.json({
      user: request.user,
      profile: profile
        ? {
            programme: profile.programme,
            cohort: profile.cohort,
            startingSemester: profile.startingSemester ?? "Y1S1",
            currentSemester: profile.currentSemester ?? profile.startingSemester ?? "Y1S1",
            graduationSemester: profile.graduationSemester,
            primaryPlanId: profile.primaryPlanId?.toString()
          }
        : null
    });
  } catch (error) {
    next(error);
  }
});
