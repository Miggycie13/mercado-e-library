import { PrismaClient } from "../generated/prisma/client";
import { createSqlJsAdapter } from "./sqlite";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

export const prisma = new PrismaClient({
  adapter: createSqlJsAdapter(databaseUrl),
});
