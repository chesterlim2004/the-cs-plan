import { Router } from "express";
import { clearSessionCookie, setSessionCookie } from "../middleware/auth.js";
import { buildGoogleAuthUrl, exchangeCodeForGoogleUser } from "../services/googleAuthService.js";
import { upsertGoogleUser } from "../services/userService.js";
import { env } from "../config/env.js";

export const authRoutes = Router();

authRoutes.get("/google", (_request, response) => {
  response.redirect(buildGoogleAuthUrl());
});

authRoutes.get("/google/callback", async (request, response, next) => {
  try {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (!code) {
      response.redirect(`${env.clientUrl}/login?error=missing_code`);
      return;
    }

    const googleUser = await exchangeCodeForGoogleUser(code);
    const user = await upsertGoogleUser(googleUser);
    setSessionCookie(response, user._id.toString());
    response.redirect(`${env.clientUrl}/planner`);
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/logout", (_request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});
