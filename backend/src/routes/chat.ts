import { Router, Request, Response } from "express";
import Chat from "../models/Chat";
import { redisPubSub } from "../services/redisPubSub";

const router = Router();

/**
 * POST /api/chat/ask
 */
router.post("/ask", async (req: Request, res: Response) => {
  try {
    const { sessionId, question } = req.body;

    if (!sessionId || !question || !question.trim()) {
      return res.status(400).json({
        error: "sessionId and question are required",
      });
    }

    const result = await redisPubSub.askQuestion(
      sessionId,
      question.trim()
    );

    await Chat.create({
      sessionId,
      question: question.trim(),
      answer: result.answer,
      sources: result.sources,
      suggestedQuestions: result.suggestedQuestions,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[chat] ask error:", err);

    return res.status(500).json({
      error: err.message || "AI service failed",
    });
  }
});

/**
 * GET /api/chat/history/:sessionId
 */
router.get("/history/:sessionId", async (req: Request, res: Response) => {
  try {
    const chats = await Chat.find({
      sessionId: req.params.sessionId,
    }).sort({
      timestamp: 1,
    });

    return res.json({
      chats,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Failed to fetch history",
    });
  }
});

/**
 * GET /api/chat/sessions
 * Returns all chat sessions
 */
router.get("/sessions", async (_req: Request, res: Response) => {
  try {
    const sessions = await Chat.aggregate([
      {
        $sort: {
          timestamp: -1,
        },
      },
      {
        $group: {
          _id: "$sessionId",

          firstQuestion: {
            $first: "$question",
          },

          lastUpdated: {
            $first: "$timestamp",
          },
        },
      },
      {
        $sort: {
          lastUpdated: -1,
        },
      },
    ]);

    return res.json({
      sessions: sessions.map((session) => ({
        sessionId: session._id,
        title: session.firstQuestion,
        lastUpdated: session.lastUpdated,
      })),
    });
  } catch (err) {
    console.error("[chat] sessions error:", err);

    return res.status(500).json({
      error: "Failed to load chat sessions",
    });
  }
});

export default router;