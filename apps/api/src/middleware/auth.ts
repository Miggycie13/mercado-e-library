import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";
import { HttpError } from "../types";

function readToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  if (typeof req.query.access_token === "string") return req.query.access_token;
  return "";
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next();
  try {
    req.user = verifyToken(token);
  } catch {
    req.user = undefined;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(new HttpError(401, "Sign in to continue."));
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, "Your session expired. Sign in again."));
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (error) => {
    if (error) return next(error);
    if (req.user?.role !== "admin") return next(new HttpError(403, "Admin access is required."));
    next();
  });
}
