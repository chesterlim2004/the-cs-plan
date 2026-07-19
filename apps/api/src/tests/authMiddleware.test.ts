import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

describe("requireAuth", () => {
  it("rejects unauthenticated requests", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const response = { status, json } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requireAuth({} as Request, response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  it("rejects authenticated students", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const response = { status, json } as unknown as Response;
    const next = vi.fn() as NextFunction;
    const request = {
      user: {
        id: "student-id",
        email: "student@example.com",
        name: "Student",
        role: "student"
      }
    } as Request;

    requireAdmin(request, response, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "Administrator access required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows authenticated administrators", () => {
    const response = {} as Response;
    const next = vi.fn() as NextFunction;
    const request = {
      user: {
        id: "admin-id",
        email: "admin@example.com",
        name: "Administrator",
        role: "admin"
      }
    } as Request;

    requireAdmin(request, response, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
