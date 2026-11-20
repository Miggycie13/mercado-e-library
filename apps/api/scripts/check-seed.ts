import "dotenv/config";

process.env.DATABASE_URL = "file:./seed-test.db";

async function main() {
  const { seedDatabase } = await import("../src/seed");
  const { prisma } = await import("../src/lib/prisma");
  const count = await seedDatabase();
  const book = await prisma.book.findFirst({ where: { title: "A Christmas Carol" } });
  const admin = await prisma.user.findUnique({ where: { email: "admin@elibrary.local" } });
  console.log(JSON.stringify({ count, title: book?.title, admin: admin?.name }));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
