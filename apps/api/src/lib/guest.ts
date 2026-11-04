import crypto from "crypto";
import type { Request } from "express";

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (raw || req.ip || "unknown").trim().replace(/^::ffff:/, "");
}

export function guestKeyFromRequest(req: Request): string {
  const ip = clientIp(req);
  return crypto.createHash("sha256").update(`elibrary-guest:${ip}`).digest("hex").slice(0, 32);
}

export function guestLimit() {
  return Number(process.env.GUEST_DOWNLOAD_LIMIT || 5);
}

export function userLimit() {
  return Number(process.env.USER_DOWNLOAD_LIMIT || 10);
}
