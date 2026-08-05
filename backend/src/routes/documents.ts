import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import DocumentModel from "../models/Document";
import { requireAdminAuth, AuthenticatedRequest } from "../middleware/auth";
import { redisPubSub } from "../services/redisPubSub";

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// All routes require authentication
router.use(requireAdminAuth);

/**
 * Upload PDF
 */
router.post(
  "/upload",
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No PDF uploaded",
        });
      }

      // ✅ Convert to absolute path
      const absolutePath = path.resolve(req.file.path);

      const doc = await DocumentModel.create({
        fileName: req.file.originalname,
        filePath: req.file.filename,
        processingStatus: "pending",
        chunkCount: 0,
      });

      // Start processing in background
      processInBackground(
        doc.id,
        absolutePath,
        req.file.originalname
      );

      return res.status(201).json({
        document: doc,
      });
    } catch (err) {
      console.error("[documents] upload error", err);

      return res.status(500).json({
        error: "Failed to upload document",
      });
    }
  }
);

/**
 * Background PDF Processing
 */
async function processInBackground(
  documentId: string,
  filePath: string,
  fileName: string
) {
  try {
    await DocumentModel.findByIdAndUpdate(documentId, {
      processingStatus: "processing",
    });

    const result = await redisPubSub.processDocument(
      documentId,
      filePath,
      fileName
    );

    await DocumentModel.findByIdAndUpdate(documentId, {
      processingStatus:
        result.status === "completed" ? "completed" : "failed",
      chunkCount: result.chunkCount || 0,
      error: result.error || null,
    });

    console.log("[documents] Processing completed");
  } catch (err: any) {
    console.error("[documents] processing failed", err);

    await DocumentModel.findByIdAndUpdate(documentId, {
      processingStatus: "failed",
      error: err.message || "Unknown processing error",
    });
  }
}

/**
 * List Documents
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = (req.query.search as string) || "";

    const filter = search
      ? {
          fileName: {
            $regex: search,
            $options: "i",
          },
        }
      : {};

    const docs = await DocumentModel.find(filter).sort({
      uploadDate: -1,
    });

    return res.json({
      documents: docs,
    });
  } catch (err) {
    console.error("[documents] list error", err);

    return res.status(500).json({
      error: "Failed to list documents",
    });
  }
});

/**
 * Delete Document
 */
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doc = await DocumentModel.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    await doc.deleteOne();

    return res.json({
      message: "Document deleted",
    });
  } catch (err) {
    console.error("[documents] delete error", err);

    return res.status(500).json({
      error: "Failed to delete document",
    });
  }
});

/**
 * Reprocess Document
 */
router.post("/:id/reprocess", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doc = await DocumentModel.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    doc.processingStatus = "pending";
    doc.error = undefined;

    await doc.save();

    // ✅ Always send absolute path
    processInBackground(
      doc.id,
      path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads", doc.filePath),
      doc.fileName
    );

    return res.json({
      message: "Reprocessing started",
      document: doc,
    });
  } catch (err) {
    console.error("[documents] reprocess error", err);

    return res.status(500).json({
      error: "Failed to reprocess document",
    });
  }
});

export default router;