import { Router } from "express";
import { PlanSchema } from "@the-cs-plan/shared";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  createPlan,
  deleteOwnedPlan,
  evaluateOwnedPlan,
  exportOwnedPlan,
  getOwnedPlan,
  importPlan,
  listPlans,
  updateOwnedPlan
} from "../services/planService.js";

export const planRoutes = Router();

planRoutes.use(requireAuth);

planRoutes.get("/", async (request, response, next) => {
  try {
    response.json(await listPlans(request.user!.id));
  } catch (error) {
    next(error);
  }
});

planRoutes.post("/", validateBody(PlanSchema), async (request, response, next) => {
  try {
    response.status(201).json(await createPlan(request.user!.id, request.body));
  } catch (error) {
    next(error);
  }
});

planRoutes.post("/import", async (request, response, next) => {
  try {
    response.status(201).json(await importPlan(request.user!.id, request.body));
  } catch (error) {
    next(error);
  }
});

planRoutes.get("/:planId", async (request, response, next) => {
  try {
    const planId = request.params.planId;
    if (typeof planId !== "string") {
      response.status(400).json({ error: "Plan id is required" });
      return;
    }

    const plan = await getOwnedPlan(request.user!.id, planId);
    if (!plan) {
      response.status(404).json({ error: "Plan not found" });
      return;
    }

    response.json(plan);
  } catch (error) {
    next(error);
  }
});

planRoutes.put("/:planId", validateBody(PlanSchema), async (request, response, next) => {
  try {
    const planId = request.params.planId;
    if (typeof planId !== "string") {
      response.status(400).json({ error: "Plan id is required" });
      return;
    }

    const plan = await updateOwnedPlan(request.user!.id, planId, request.body);
    if (!plan) {
      response.status(404).json({ error: "Plan not found" });
      return;
    }

    response.json(plan);
  } catch (error) {
    next(error);
  }
});

planRoutes.delete("/:planId", async (request, response, next) => {
  try {
    const planId = request.params.planId;
    if (typeof planId !== "string") {
      response.status(400).json({ error: "Plan id is required" });
      return;
    }

    const deleted = await deleteOwnedPlan(request.user!.id, planId);
    if (!deleted) {
      response.status(404).json({ error: "Plan not found" });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

planRoutes.post("/:planId/evaluate", async (request, response, next) => {
  try {
    const planId = request.params.planId;
    if (typeof planId !== "string") {
      response.status(400).json({ error: "Plan id is required" });
      return;
    }

    const result = await evaluateOwnedPlan(request.user!.id, planId);
    if (!result) {
      response.status(404).json({ error: "Plan not found" });
      return;
    }

    response.json(result);
  } catch (error) {
    next(error);
  }
});

planRoutes.get("/:planId/export", async (request, response, next) => {
  try {
    const planId = request.params.planId;
    if (typeof planId !== "string") {
      response.status(400).json({ error: "Plan id is required" });
      return;
    }

    const exported = await exportOwnedPlan(request.user!.id, planId);
    if (!exported) {
      response.status(404).json({ error: "Plan not found" });
      return;
    }

    response.setHeader("Content-Disposition", `attachment; filename="the-cs-plan-export.json"`);
    response.json(exported);
  } catch (error) {
    next(error);
  }
});
