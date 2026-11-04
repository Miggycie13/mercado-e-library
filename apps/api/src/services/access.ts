import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { clientIp, guestKeyFromRequest, guestLimit, userLimit } from "../lib/guest";
import { bibliographicPdf } from "../lib/pdf";
import { HttpError } from "../types";

async function distinctBookIds(where: { userId?: string; guestKey?: string }) {
  const rows = await prisma.downloadLog.findMany({
    where,
    distinct: ["bookId"],
    select: { bookId: true },
  });
  return rows.map((row) => row.bookId);
}

export async function getQuota(req: Request) {
  if (req.user) {
    const usedIds = await distinctBookIds({ userId: req.user.id });
    const limit = userLimit();
    return { mode: "user" as const, limit, used: usedIds.length, remaining: Math.max(0, limit - usedIds.length) };
  }
  const usedIds = await distinctBookIds({ guestKey: guestKeyFromRequest(req) });
  const limit = guestLimit();
  return { mode: "guest" as const, limit, used: usedIds.length, remaining: Math.max(0, limit - usedIds.length) };
}

export async function performDownload(req: Request, bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw new HttpError(404, "Book not found.");

  const userId = req.user?.id;
  const guestKey = userId ? null : guestKeyFromRequest(req);
  const where = userId ? { userId } : { guestKey: guestKey || undefined };
  const already = await prisma.downloadLog.findFirst({ where: { ...where, bookId } });
  const quota = await getQuota(req);

  if (!already && quota.remaining <= 0) {
    const message = userId
      ? `Account download limit reached (${quota.limit} books).`
      : `Guest download limit reached (${quota.limit} books). Create a free account to raise the limit to ${userLimit()}.`;
    throw new HttpError(403, message, quota);
  }

  if (!already) {
    await prisma.downloadLog.create({
      data: {
        bookId,
        userId: userId || null,
        guestKey,
        ip: clientIp(req),
      },
    });
  }

  const bytes = await bibliographicPdf(book);
  const nextQuota = await getQuota(req);
  const filename = `${book.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book"}.pdf`;
  return { filename, bytes, quota: nextQuota, book };
}
