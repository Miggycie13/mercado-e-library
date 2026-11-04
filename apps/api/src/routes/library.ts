import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { addFavorite, addToLibrary, listFavorites, listLibrary, removeFavorite, removeFromLibrary } from "../services/shelf";

const router = Router();
router.use(requireAuth);

const bookBody = z.object({ bookId: z.string().min(1) });

router.get("/library", async (req, res, next) => {
  try {
    res.json({ books: await listLibrary(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/library", async (req, res, next) => {
  try {
    const body = bookBody.parse(req.body);
    res.status(201).json(await addToLibrary(req.user!.id, body.bookId));
  } catch (error) {
    next(error);
  }
});

router.delete("/library/:bookId", async (req, res, next) => {
  try {
    res.json(await removeFromLibrary(req.user!.id, req.params.bookId));
  } catch (error) {
    next(error);
  }
});

router.get("/favorites", async (req, res, next) => {
  try {
    res.json({ books: await listFavorites(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/favorites", async (req, res, next) => {
  try {
    const body = bookBody.parse(req.body);
    res.status(201).json(await addFavorite(req.user!.id, body.bookId));
  } catch (error) {
    next(error);
  }
});

router.delete("/favorites/:bookId", async (req, res, next) => {
  try {
    res.json(await removeFavorite(req.user!.id, req.params.bookId));
  } catch (error) {
    next(error);
  }
});

export default router;
