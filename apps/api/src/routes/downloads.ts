import { Router } from "express";
import { optionalAuth } from "../middleware/auth";
import { getQuota, performDownload } from "../services/access";

const router = Router();

router.get("/quota", optionalAuth, async (req, res, next) => {
  try {
    res.json(await getQuota(req));
  } catch (error) {
    next(error);
  }
});

router.post("/:bookId", optionalAuth, async (req, res, next) => {
  try {
    const file = await performDownload(req, req.params.bookId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("X-Downloads-Remaining", String(file.quota.remaining));
    res.setHeader("X-Download-Limit", String(file.quota.limit));
    res.send(file.bytes);
  } catch (error) {
    next(error);
  }
});

export default router;
