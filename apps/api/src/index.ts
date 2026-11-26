import "dotenv/config";
import { createApp } from "./app";
import { aiMode } from "./ai/agent";
import { flushDatabase } from "./lib/sqlite";
import { prisma } from "./lib/prisma";
import { fillBookCovers, seedDatabase } from "./seed";

async function main() {
  const port = Number(process.env.PORT || 4000);
  const app = createApp();
  await new Promise<void>((resolve) => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`E-Library API listening on http://localhost:${port} (assistant: ${aiMode()})`);
      resolve();
    });
  });
  await seedDatabase();
  flushDatabase();
  void fillBookCovers().catch((error) => {
    console.error(error instanceof Error ? error.message : "Cover lookup failed.");
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
