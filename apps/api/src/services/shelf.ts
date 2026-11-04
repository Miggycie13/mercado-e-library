import { prisma } from "../lib/prisma";
import { HttpError } from "../types";

const includeBook = { book: true } as const;

export async function listLibrary(userId: string) {
  const items = await prisma.libraryItem.findMany({
    where: { userId },
    include: includeBook,
    orderBy: { createdAt: "desc" },
  });
  return items.map((item) => ({ savedAt: item.createdAt, ...item.book }));
}

export async function addToLibrary(userId: string, bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw new HttpError(404, "Book not found.");
  const existing = await prisma.libraryItem.findUnique({ where: { userId_bookId: { userId, bookId } } });
  if (!existing) {
    await prisma.libraryItem.create({ data: { userId, bookId } });
  }
  await prisma.favorite.upsert({
    where: { userId_bookId: { userId, bookId } },
    update: {},
    create: { userId, bookId },
  });
  return {
    ok: true,
    alreadyInLibrary: Boolean(existing),
    bookId: book.id,
    title: book.title,
    author: book.author,
  };
}

export async function removeFromLibrary(userId: string, bookId: string) {
  await prisma.libraryItem.deleteMany({ where: { userId, bookId } });
  return { ok: true };
}

export async function listFavorites(userId: string) {
  const items = await prisma.favorite.findMany({
    where: { userId },
    include: includeBook,
    orderBy: { createdAt: "desc" },
  });
  return items.map((item) => ({ savedAt: item.createdAt, ...item.book }));
}

export async function addFavorite(userId: string, bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw new HttpError(404, "Book not found.");
  await prisma.favorite.upsert({
    where: { userId_bookId: { userId, bookId } },
    update: {},
    create: { userId, bookId },
  });
  return { ok: true, bookId, title: book.title };
}

export async function removeFavorite(userId: string, bookId: string) {
  await prisma.favorite.deleteMany({ where: { userId, bookId } });
  return { ok: true };
}
