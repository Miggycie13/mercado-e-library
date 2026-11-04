import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";
import { HttpError } from "../types";

const router = Router();
router.use(requireAdmin);

const bookSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  category: z.string().trim().min(1),
  year: z.coerce.number().int().min(1).max(2100),
  description: z.string().trim().min(10),
  sourceUrl: z.union([z.string().trim().url(), z.literal("")]).optional(),
});

router.get("/analytics", async (_req, res, next) => {
  try {
    const dayKey = (date: Date) => {
      const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
      return shifted.toISOString().slice(0, 10);
    };
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);
    const [books, users, downloads, favorites, libraryItems, byCategory, topRows, recent, recentLogs] = await Promise.all([
      prisma.book.count(),
      prisma.user.count(),
      prisma.downloadLog.count(),
      prisma.favorite.count(),
      prisma.libraryItem.count(),
      prisma.book.groupBy({ by: ["category"], _count: { category: true }, orderBy: { category: "asc" } }),
      prisma.downloadLog.groupBy({ by: ["bookId"], _count: { bookId: true }, orderBy: { _count: { bookId: "desc" } }, take: 6 }),
      prisma.downloadLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { book: true, user: true },
      }),
      prisma.downloadLog.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);
    const topBooks = await Promise.all(
      topRows.map(async (row) => {
        const book = await prisma.book.findUnique({ where: { id: row.bookId } });
        return { id: row.bookId, title: book?.title || "Removed book", author: book?.author || "", downloads: row._count.bookId };
      })
    );
    const days = Array.from({ length: 14 }, (_, index) => {
      const day = new Date(since);
      day.setDate(since.getDate() + index);
      const key = dayKey(day);
      return { day: key, downloads: 0 };
    });
    for (const log of recentLogs) {
      const key = dayKey(log.createdAt);
      const bucket = days.find((day) => day.day === key);
      if (bucket) bucket.downloads += 1;
    }
    res.json({
      totals: { books, users, downloads, favorites, libraryItems },
      byCategory: byCategory.map((row) => ({ category: row.category, count: row._count.category })),
      topBooks,
      recentDownloads: recent.map((row) => ({
        id: row.id,
        at: row.createdAt,
        title: row.book.title,
        reader: row.user?.email || "Guest",
      })),
      daily: days,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/books", async (_req, res, next) => {
  try {
    const books = await prisma.book.findMany({ orderBy: { updatedAt: "desc" }, take: 300 });
    res.json({ books });
  } catch (error) {
    next(error);
  }
});

router.post("/books", async (req, res, next) => {
  try {
    const body = bookSchema.parse(req.body);
    const book = await prisma.book.create({
      data: { ...body, sourceUrl: body.sourceUrl || null },
    });
    res.status(201).json({ book });
  } catch (error) {
    next(error);
  }
});

router.put("/books/:id", async (req, res, next) => {
  try {
    const body = bookSchema.parse(req.body);
    const existing = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Book not found.");
    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { ...body, sourceUrl: body.sourceUrl || null },
    });
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

router.delete("/books/:id", async (req, res, next) => {
  try {
    await prisma.book.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
