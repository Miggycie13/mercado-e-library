import { describeBook, seedBooks } from "./data/books";
import { hashPassword } from "./lib/auth";
import { prisma } from "./lib/prisma";
import { execScript } from "./lib/sqlite";

function sqlText(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function seedDatabase() {
  const titles = seedBooks.map((book) => book.title.toLowerCase());
  const unique = new Set(titles);
  if (unique.size < 200 || unique.size !== seedBooks.length) {
    throw new Error(`Seed catalog must contain at least 200 unique titles. Found ${unique.size} unique of ${seedBooks.length}.`);
  }

  const now = Date.now();
  const adminPassword = await hashPassword(process.env.ADMIN_PASSWORD || "Admin123!");
  const readerPassword = await hashPassword(process.env.READER_PASSWORD || "Reader123!");
  const existing = await prisma.book.count();
  const users = `
    INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "createdAt")
    VALUES ('user-admin', 'admin@elibrary.local', 'Library Admin', ${sqlText(adminPassword)}, 'admin', ${now})
    ON CONFLICT("email") DO UPDATE SET
      "name" = 'Library Admin',
      "role" = 'admin',
      "passwordHash" = ${sqlText(adminPassword)};
    INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "createdAt")
    VALUES ('user-reader', 'reader@elibrary.local', 'Ava Reader', ${sqlText(readerPassword)}, 'user', ${now})
    ON CONFLICT("email") DO UPDATE SET
      "name" = 'Ava Reader',
      "role" = 'user',
      "passwordHash" = ${sqlText(readerPassword)};
  `;

  if (existing >= 200) {
    execScript(users);
    console.log(`Catalog already has ${existing} books. Skipped book seed.`);
    return existing;
  }

  const values = seedBooks.map((book, index) => {
    const sourceUrl = book.gutenbergId ? `https://www.gutenberg.org/ebooks/${book.gutenbergId}` : null;
    return `('seed-${index + 1}', ${sqlText(book.title)}, ${sqlText(book.author)}, ${sqlText(book.category)}, ${book.year}, 'English', ${sqlText(describeBook(book))}, ${sourceUrl ? sqlText(sourceUrl) : "NULL"}, ${now}, ${now})`;
  });
  execScript(`
    ${users}
    INSERT INTO "Book" ("id", "title", "author", "category", "year", "language", "description", "sourceUrl", "createdAt", "updatedAt")
    VALUES ${values.join(",\n")}
    ON CONFLICT("title", "author") DO NOTHING;
  `);

  const count = await prisma.book.count();
  console.log(`Catalog ready with ${count} books.`);
  return count;
}
