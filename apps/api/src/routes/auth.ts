import { Router } from "express";
import { z } from "zod";
import { checkPassword, hashPassword, publicUser, signToken } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { fileContains, flushDatabase } from "../lib/sqlite";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../types";

const router = Router();

const credentials = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

router.post("/register", async (req, res, next) => {
  try {
    const body = credentials.extend({ name: z.string().min(2, "Enter your name.") }).parse(req.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "An account with that email already exists.");
    const user = await prisma.user.create({
      data: { email, name: body.name.trim(), passwordHash: await hashPassword(body.password), role: "user" },
    });
    flushDatabase();
    if (!fileContains(email)) throw new HttpError(500, "The account could not be saved.");
    const safe = publicUser(user);
    res.status(201).json({ token: signToken(safe), user: safe });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await checkPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    const safe = publicUser(user);
    res.json({ token: signToken(safe), user: safe });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(401, "Account not found.");
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
