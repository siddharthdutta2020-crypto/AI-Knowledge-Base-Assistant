import { Router, Response } from "express";
import DocumentModel from "../models/Document";
import Chat from "../models/Chat";
import { requireAdminAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

router.use(requireAdminAuth);

/**
 * GET /api/dashboard
 * Returns the 4 stats required by the assignment plus recent documents.
 */
router.get("/", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [totalPdfs, totalQuestions, recentDocuments, distinctSessions] = await Promise.all([
      DocumentModel.countDocuments(),
      Chat.countDocuments(),
      DocumentModel.find().sort({ uploadDate: -1 }).limit(5),
      Chat.distinct("sessionId"),
    ]);

    return res.json({
      totalUploadedPdfs: totalPdfs,
      totalChatSessions: distinctSessions.length,
      totalQuestionsAsked: totalQuestions,
      recentUploadedDocuments: recentDocuments,
    });
  } catch (err) {
    console.error("[dashboard] error", err);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;
