import { prisma } from "../lib/prisma";
import { HttpError } from "../types";

const STOP = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "me", "my", "about",
  "book", "books", "story", "stories", "please", "find", "show", "with", "from",
  "that", "this", "what", "which", "who", "is", "are", "was", "i", "want", "read",
  "something", "like", "recommend", "suggest", "good", "best", "any", "can", "you",
]);

export function searchTokens(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function haystack(book: { title: string; author: string; category: string; description: string }) {
  return `${book.title} ${book.author} ${book.category} ${book.description}`.toLowerCase();
}

export async function listCategories() {
  const rows = await prisma.book.groupBy({
    by: ["category"],
    _count: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((row) => ({ name: row.category, count: row._count.category }));
}

export async function searchBooks(params: {
  query?: string;
  category?: string;
  author?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize || 24));
  const tokens = searchTokens(params.query || "");
  const category = params.category?.trim();
  const author = params.author?.trim();

  if (!tokens.length && !author) {
    const where = category ? { category } : {};
    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        orderBy: [{ title: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, books };
  }

  const books = await prisma.book.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(author ? { author: { contains: author } } : {}),
    },
  });
  const ranked = books
    .map((book) => {
      const text = haystack(book);
      const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
      const authorScore = author && book.author.toLowerCase().includes(author.toLowerCase()) ? 2 : 0;
      return { book, score: score + authorScore };
    })
    .filter((row) => (tokens.length ? row.score > 0 : true))
    .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title));

  const start = (page - 1) * pageSize;
  return {
    total: ranked.length,
    page,
    pageSize,
    books: ranked.slice(start, start + pageSize).map((row) => row.book),
  };
}

export async function getBook(id: string, userId?: string) {
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) throw new HttpError(404, "Book not found.");
  if (!userId) return { ...book, inLibrary: false, isFavorite: false };
  const [libraryItem, favorite] = await Promise.all([
    prisma.libraryItem.findUnique({ where: { userId_bookId: { userId, bookId: id } } }),
    prisma.favorite.findUnique({ where: { userId_bookId: { userId, bookId: id } } }),
  ]);
  return { ...book, inLibrary: Boolean(libraryItem), isFavorite: Boolean(favorite) };
}

export function bookSummary(book: {
  id: string;
  title: string;
  author: string;
  category: string;
  year: number;
  description: string;
}) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    year: book.year,
    description: book.description,
  };
}
