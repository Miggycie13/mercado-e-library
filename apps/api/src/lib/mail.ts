import crypto from "crypto";
import { HttpError } from "../types";

const SECRET = process.env.JWT_SECRET || "mercado-library-dev-secret-change-me";
const TEN_MINUTES = 10 * 60 * 1000;

export function confirmationRequired() {
  return Boolean(process.env.RESEND_API_KEY) || process.env.MAIL_DEV === "1";
}

export function createConfirmationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function confirmationExpiry() {
  return new Date(Date.now() + TEN_MINUTES);
}

export function hashConfirmationCode(code: string) {
  return crypto.createHash("sha256").update(`${SECRET}:${code}`).digest("hex");
}

export function codeMatches(code: string, hash: string) {
  const actual = Buffer.from(hashConfirmationCode(code));
  const expected = Buffer.from(hash);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export async function sendConfirmationCode(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.MAIL_DEV === "1") {
      console.log(`Confirmation code for ${email}: ${code}`);
      return;
    }
    throw new HttpError(503, "The confirmation email could not be sent.");
  }
  const from = process.env.MAIL_FROM || "The Emerald Archive <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your Emerald Archive code",
      text: `Your confirmation code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) {
    console.error(`Confirmation email was rejected (${response.status}).`);
    throw new HttpError(503, "The confirmation email could not be sent.");
  }
}
