import "dotenv/config";
import { exec } from "child_process";
import { promisify } from "util";
import { createApp } from "./app";
import { aiMode } from "./ai/agent";
import { prisma } from "./lib/prisma";
import { seedDatabase } from "./seed";

const execAsync = promisify(exec);

async function ensureDatabase() {
  await execAsync("npx prisma db push --skip-generate");
}

async function main() {
  const port = Number(process.env.PORT || 4000);
  const app = createApp();
  await new Promise<void>((resolve) => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`E-Library API listening on http://localhost:${port} (assistant: ${aiMode()})`);
      resolve();
    });
  });
  ensureDatabase();
  await seedDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
