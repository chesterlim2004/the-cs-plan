import { Router } from "express";
import { CohortSchema, ProgrammeSchema } from "@the-cs-plan/shared";
import { requireAuth } from "../middleware/auth.js";
import { listModuleRequirementTags } from "../services/moduleRequirementTagService.js";
import { getModule, searchModules } from "../services/moduleService.js";

export const moduleRoutes = Router();

moduleRoutes.get("/", requireAuth, async (request, response, next) => {
  try {
    const query = typeof request.query.query === "string" ? request.query.query : "";
    response.json(await searchModules(query));
  } catch (error) {
    next(error);
  }
});

moduleRoutes.get("/tags/:programme/:cohort", requireAuth, async (request, response, next) => {
  try {
    const programme = ProgrammeSchema.parse(request.params.programme);
    const cohort = CohortSchema.parse(request.params.cohort);
    response.json(await listModuleRequirementTags(programme, cohort));
  } catch (error) {
    next(error);
  }
});

moduleRoutes.get("/:moduleCode", requireAuth, async (request, response, next) => {
  try {
    const moduleCode = request.params.moduleCode;
    if (typeof moduleCode !== "string") {
      response.status(400).json({ error: "Module code is required" });
      return;
    }

    const module = await getModule(moduleCode);
    if (!module) {
      response.status(404).json({ error: "Module not found" });
      return;
    }

    response.json(module);
  } catch (error) {
    next(error);
  }
});
