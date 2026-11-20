import { createHash, randomInt, timingSafeEqual } from "crypto";

const TEN_MINUTES = 10 * 60 * 1000;

export function confirmationRequired() {
  return Boolean(process.env.BREVO_API_KEY);
}

export function createConfirmationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function confirmationExpiry() {
  return new Date(Date.now() + TEN_MINUTES);
}

export function hashConfirmationCode(code: string) {
  const secret = process.env.JWT_SECRET || "mercado-library-dev-secret-change-me";
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

export function codeMatches(code: string, hash: string | null, expiresAt: Date | string | null) {
  if (!hash || !expiresAt) return false;
  if (new Date(expiresAt).getTime() <= Date.now()) return false;
  const actual = Buffer.from(hashConfirmationCode(code));
  const expected = Buffer.from(hash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export async function sendConfirmationCode(email: string, code: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) throw new Error("missing-mail-config");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "The Emerald Archive", email: from },
      to: [{ email }],
      subject: "Your Emerald Archive code",
      textContent: `Your Emerald Archive code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) throw new Error("brevo-send-failed");
}
