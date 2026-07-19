import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env.js";
import { optionalAuth } from "./middleware/auth.js";
import { HttpError } from "./lib/HttpError.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { meRoutes } from "./routes/meRoutes.js";
import { moduleRoutes } from "./routes/moduleRoutes.js";
import { planRoutes } from "./routes/planRoutes.js";
import { profileRoutes } from "./routes/profileRoutes.js";
import { requirementRoutes } from "./routes/requirementRoutes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(optionalAuth);

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/me", meRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/modules", moduleRoutes);
  app.use("/api/plans", planRoutes);
  app.use("/api/requirements", requirementRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = error instanceof HttpError
      ? error.status
      : message.includes("Invalid") || message.includes("required")
        ? 400
        : 500;
    response.status(status).json({ error: message });
  });

  return app;
}
