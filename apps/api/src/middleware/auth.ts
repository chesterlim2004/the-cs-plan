import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";

const cookieName = "tcp_session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "student" | "admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface SessionPayload {
  userId: string;
}

export function createSessionToken(userId: string): string {
  return jwt.sign({ userId }, env.sessionSecret, { expiresIn: "7d" });
}

export function setSessionCookie(response: Response, userId: string): void {
  response.cookie(cookieName, createSessionToken(userId), {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax"
  });
}

export async function optionalAuth(
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> {
  const token = request.cookies?.[cookieName] as string | undefined;
  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, env.sessionSecret) as SessionPayload;
    const user = await UserModel.findById(payload.userId).lean();
    if (user?._id) {
      request.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role
      };
    }
  } catch {
    request.user = undefined;
  }

  next();
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  if (!request.user) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }

  next();
}
