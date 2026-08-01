import { Router } from "express";
import {
  AdminCloneCurriculumCreateSchema,
  AdminCloneCurriculumSchema,
  AdminCurriculumDraftSchema,
  CohortSchema,
  ProgrammeSchema
} from "@the-cs-plan/shared";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  cloneAdminCurriculum,
  getAdminCurriculum,
  listAdminCurriculumModuleTags,
  listAdminCurricula,
  previewCurriculumClone,
  publishAdminCurriculumDraft,
  searchAdminModuleTags,
  validateAdminCurriculumDraft
} from "../services/adminCurriculumService.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get("/catalog", async (_request, response, next) => {
  try {
    response.json({ curricula: await listAdminCurricula() });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/curricula/:programme/:cohort", async (request, response, next) => {
  try {
    const programme = ProgrammeSchema.parse(request.params.programme);
    const cohort = CohortSchema.parse(request.params.cohort);
    const requirementSet = await getAdminCurriculum(programme, cohort);
    if (!requirementSet) {
      response.status(404).json({ error: "Curriculum not found" });
      return;
    }
    response.json(requirementSet);
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/module-tags/:programme/:cohort/available", async (request, response, next) => {
  try {
    const programme = ProgrammeSchema.parse(request.params.programme);
    const cohort = CohortSchema.parse(request.params.cohort);
    response.json(await listAdminCurriculumModuleTags(programme, cohort));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/module-tags/:programme/:cohort", async (request, response, next) => {
  try {
    const programme = ProgrammeSchema.parse(request.params.programme);
    const cohort = CohortSchema.parse(request.params.cohort);
    const query = typeof request.query.query === "string" ? request.query.query : "";
    const tag = typeof request.query.tag === "string" ? request.query.tag : "";
    const requestedPage = Number(request.query.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    response.json(await searchAdminModuleTags(programme, cohort, query, page, tag));
  } catch (error) {
    next(error);
  }
});

adminRoutes.post(
  "/validate",
  validateBody(AdminCurriculumDraftSchema),
  async (request, response, next) => {
    try {
      response.json(await validateAdminCurriculumDraft(request.body));
    } catch (error) {
      next(error);
    }
  }
);

adminRoutes.post(
  "/publish",
  validateBody(AdminCurriculumDraftSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await publishAdminCurriculumDraft(request.body));
    } catch (error) {
      next(error);
    }
  }
);

adminRoutes.post(
  "/clone/preview",
  validateBody(AdminCloneCurriculumSchema),
  async (request, response, next) => {
    try {
      response.json(await previewCurriculumClone(request.body));
    } catch (error) {
      next(error);
    }
  }
);

adminRoutes.post(
  "/clone",
  validateBody(AdminCloneCurriculumCreateSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await cloneAdminCurriculum(request.body));
    } catch (error) {
      next(error);
    }
  }
);
