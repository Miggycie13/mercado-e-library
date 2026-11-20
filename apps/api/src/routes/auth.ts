import { Router } from "express";
import { z } from "zod";
import { checkPassword, hashPassword, publicUser, signToken } from "../lib/auth";
import {
  codeMatches,
  confirmationExpiry,
  confirmationRequired,
  createConfirmationCode,
  hashConfirmationCode,
  sendConfirmationCode,
} from "../lib/mail";
import { prisma } from "../lib/prisma";
import { fileContains, flushDatabase } from "../lib/sqlite";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../types";

const router = Router();

const credentials = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const codeBody = z.object({
  email: z.string().email("Enter a valid email."),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

async function sendCode(userId: string, email: string) {
  const code = createConfirmationCode();
  await prisma.user.update({
    where: { id: userId },
    data: { otpHash: hashConfirmationCode(code), otpExpiresAt: confirmationExpiry() },
  });
  flushDatabase();
  if (!fileContains(email)) throw new HttpError(500, "The account could not be saved.");
  await sendConfirmationCode(email, code);
}

router.post("/register", async (req, res, next) => {
  try {
    const body = credentials.extend({ name: z.string().min(2, "Enter your name.") }).parse(req.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (confirmationRequired() && !existing.emailVerified) {
        if (!(await checkPassword(body.password, existing.passwordHash))) {
          throw new HttpError(401, "Email or password is incorrect.");
        }
        await sendCode(existing.id, email);
        res.json({ pending: true, email });
        return;
      }
      throw new HttpError(409, "An account with that email already exists.");
    }
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        passwordHash: await hashPassword(body.password),
        role: "user",
        emailVerified: !confirmationRequired(),
      },
    });
    if (!confirmationRequired()) {
      flushDatabase();
      if (!fileContains(email)) throw new HttpError(500, "The account could not be saved.");
      const safe = publicUser(user);
      res.status(201).json({ token: signToken(safe), user: safe });
      return;
    }
    await sendCode(user.id, email);
    console.log(`Registered ${email} and sent a confirmation code`);
    res.status(201).json({ pending: true, email });
  } catch (error) {
    next(error);
  }
});

router.post("/code", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified && (await checkPassword(body.password, user.passwordHash))) {
      await sendCode(user.id, email);
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const body = codeBody.parse(req.body);
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const expired = !user?.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now();
    if (!user || !user.otpHash || expired || !codeMatches(body.code, user.otpHash)) {
      throw new HttpError(400, "That code is incorrect or expired.");
    }
    const confirmed = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, otpHash: null, otpExpiresAt: null },
    });
    flushDatabase();
    const safe = publicUser(confirmed);
    res.json({ token: signToken(safe), user: safe });
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
    if (confirmationRequired() && !user.emailVerified) {
      throw new HttpError(403, "Enter the code sent to your email.", { code: "unconfirmed" });
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
