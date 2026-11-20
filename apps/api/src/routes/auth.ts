import { Router } from "express";
import { z } from "zod";
import { checkPassword, hashPassword, publicUser, signToken } from "../lib/auth";
import { codeMatches, confirmationExpiry, confirmationRequired, createConfirmationCode, hashConfirmationCode, sendConfirmationCode } from "../lib/mail";
import { prisma } from "../lib/prisma";
import { fileContains, flushDatabase } from "../lib/sqlite";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../types";

const router = Router();

const credentials = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const mailError = () => new HttpError(500, "The confirmation email could not be sent.");

async function storeAndSendCode(userId: string, email: string) {
  if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM) throw mailError();
  const code = createConfirmationCode();
  await prisma.user.update({
    where: { id: userId },
    data: { otpHash: hashConfirmationCode(code), otpExpiresAt: confirmationExpiry() },
  });
  try {
    await sendConfirmationCode(email, code);
  } catch {
    throw mailError();
  }
}

router.post("/register", async (req, res, next) => {
  try {
    const body = credentials.extend({ name: z.string().min(2, "Enter your name.") }).parse(req.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "An account with that email already exists.");
    const pending = confirmationRequired();
    if (pending && !process.env.MAIL_FROM) throw mailError();
    const code = pending ? createConfirmationCode() : null;
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        passwordHash: await hashPassword(body.password),
        role: "user",
        emailVerified: !pending,
        otpHash: code ? hashConfirmationCode(code) : null,
        otpExpiresAt: code ? confirmationExpiry() : null,
      },
    });
    flushDatabase();
    if (!fileContains(email)) throw new HttpError(500, "The account could not be saved.");
    if (pending && code) {
      try {
        await sendConfirmationCode(email, code);
      } catch {
        throw mailError();
      }
      res.status(201).json({ pending: true });
      return;
    }
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
    if (!user.emailVerified) throw new HttpError(403, "Enter the code sent to your email.", { code: "unconfirmed" });
    const safe = publicUser(user);
    res.json({ token: signToken(safe), user: safe });
  } catch (error) {
    next(error);
  }
});

router.post("/code", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await checkPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    await storeAndSendCode(user.id, email);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const body = z.object({
      email: z.string().email("Enter a valid email."),
      code: z.string(),
    }).parse(req.body);
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !codeMatches(body.code.trim(), user.otpHash, user.otpExpiresAt)) {
      throw new HttpError(400, "That code is incorrect or expired.");
    }
    const confirmed = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, otpHash: null, otpExpiresAt: null },
    });
    const safe = publicUser(confirmed);
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
