import { Router } from "express";
import { z } from "zod";
import { confirmAction, runChat } from "../ai/agent";
import { optionalAuth, requireAuth } from "../middleware/auth";

const router = Router();

const chatSchema = z.object({
  sessionId: z.string().min(1).max(80).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(30),
});

router.post("/chat", optionalAuth, async (req, res, next) => {
  try {
    const body = chatSchema.parse(req.body);
    const result = await runChat({
      sessionId: body.sessionId || req.user?.id || "guest",
      messages: body.messages,
      userId: req.user?.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      confirmationId: z.string().min(8),
      accept: z.boolean(),
    }).parse(req.body);
    res.json(await confirmAction(body.confirmationId, req.user!.id, body.accept));
  } catch (error) {
    next(error);
  }
});

export default router;
