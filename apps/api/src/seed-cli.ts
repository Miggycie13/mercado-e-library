import "dotenv/config";
import { execSync } from "child_process";
import { prisma } from "./lib/prisma";
import { seedDatabase } from "./seed";

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

seedDatabase()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
