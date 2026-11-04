import { Router } from "express";
import { listCategories, searchBooks, getBook } from "../services/catalog";
import { optionalAuth } from "../middleware/auth";

const router = Router();

router.get("/categories", async (_req, res, next) => {
  try {
    res.json({ categories: await listCategories() });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const result = await searchBooks({
      query: String(req.query.q || ""),
      category: String(req.query.category || ""),
      author: String(req.query.author || ""),
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 24),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    res.json({ book: await getBook(req.params.id, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

export default router;
