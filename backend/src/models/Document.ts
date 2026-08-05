import { Schema, model, Document as MongooseDocument } from "mongoose";

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface IDocument extends MongooseDocument {
  fileName: string;
  filePath: string;
  uploadDate: Date;
  processingStatus: ProcessingStatus;
  chunkCount?: number;
  error?: string;
}

const documentSchema = new Schema<IDocument>(
  {
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    chunkCount: { type: Number, default: 0 },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

export default model<IDocument>("Document", documentSchema);
