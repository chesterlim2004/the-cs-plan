import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";

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
