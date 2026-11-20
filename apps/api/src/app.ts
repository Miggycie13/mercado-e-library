import fs from "fs";
import path from "path";
import { Prisma } from "./generated/prisma/client";
import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { aiMode } from "./ai/agent";
import { prisma } from "./lib/prisma";
import adminRoutes from "./routes/admin";
import aiRoutes from "./routes/ai";
import authRoutes from "./routes/auth";
import bookRoutes from "./routes/books";
import downloadRoutes from "./routes/downloads";
import libraryRoutes from "./routes/library";
import { HttpError } from "./types";

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", async (_req, res) => {
    try {
      const books = await prisma.book.count();
      res.json({ ok: true, books, ai: aiMode() });
    } catch {
      res.json({ ok: true, books: 0, ai: aiMode() });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/books", bookRoutes);
  app.use("/api/downloads", downloadRoutes);
  app.use("/api/user", libraryRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/ai", aiRoutes);

  const webDist = process.env.WEB_DIST || path.resolve(__dirname, "../../web/dist");
  if (fs.existsSync(path.join(webDist, "index.html"))) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: error.issues[0]?.message || "Invalid input." });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, ...error.extra });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "That record already exists." });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Record not found." });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Server error." });
  });

  return app;
}
