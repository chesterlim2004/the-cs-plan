import { Router } from "express";
import { CohortSchema, ProgrammeSchema } from "@the-cs-plan/shared";
import { requireAuth } from "../middleware/auth.js";
import { getRequirementSet } from "../services/requirementService.js";

export const requirementRoutes = Router();

requirementRoutes.get("/:programme/:cohort", requireAuth, async (request, response, next) => {
  try {
    const programme = ProgrammeSchema.parse(request.params.programme);
    const cohort = CohortSchema.parse(request.params.cohort);
    response.json(await getRequirementSet(programme, cohort));
  } catch (error) {
    next(error);
  }
});
