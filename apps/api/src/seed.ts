import { describeBook, seedBooks } from "./data/books";
import { hashPassword } from "./lib/auth";
import { prisma } from "./lib/prisma";

export async function seedDatabase() {
  const titles = seedBooks.map((book) => book.title.toLowerCase());
  const unique = new Set(titles);
  if (unique.size < 200 || unique.size !== seedBooks.length) {
    throw new Error(`Seed catalog must contain at least 200 unique titles. Found ${unique.size} unique of ${seedBooks.length}.`);
  }

  const adminPassword = await hashPassword(process.env.ADMIN_PASSWORD || "Admin123!");
  const readerPassword = await hashPassword(process.env.READER_PASSWORD || "Reader123!");
  await prisma.user.upsert({
    where: { email: "admin@elibrary.local" },
    update: { name: "Library Admin", role: "admin", passwordHash: adminPassword },
    create: {
      email: "admin@elibrary.local",
      name: "Library Admin",
      role: "admin",
      passwordHash: adminPassword,
    },
  });
  await prisma.user.upsert({
    where: { email: "reader@elibrary.local" },
    update: { name: "Ava Reader", role: "user", passwordHash: readerPassword },
    create: {
      email: "reader@elibrary.local",
      name: "Ava Reader",
      role: "user",
      passwordHash: readerPassword,
    },
  });

  const existing = await prisma.book.count();
  if (existing >= 200) {
    console.log(`Catalog already has ${existing} books. Skipped book seed.`);
    return existing;
  }

  for (const book of seedBooks) {
    const description = describeBook(book);
    const sourceUrl = book.gutenbergId ? `https://www.gutenberg.org/ebooks/${book.gutenbergId}` : null;
    await prisma.book.upsert({
      where: { title_author: { title: book.title, author: book.author } },
      update: { category: book.category, year: book.year, description, sourceUrl, language: "English" },
      create: {
        title: book.title,
        author: book.author,
        category: book.category,
        year: book.year,
        description,
        sourceUrl,
        language: "English",
      },
    });
  }

  const count = await prisma.book.count();
  console.log(`Catalog ready with ${count} books.`);
  return count;
}
