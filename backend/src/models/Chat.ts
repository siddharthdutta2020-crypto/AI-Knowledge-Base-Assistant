import { Schema, model, Document as MongooseDocument } from "mongoose";

export interface ISource {
  documentName: string;
  pageNumber?: number;
}

export interface IChat extends MongooseDocument {
  sessionId: string;
  question: string;
  answer: string;
  sources: ISource[];
  suggestedQuestions: string[];
  timestamp: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    documentName: { type: String, required: true },
    pageNumber: { type: Number, required: false },
  },
  { _id: false }
);

const chatSchema = new Schema<IChat>({
  sessionId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  sources: { type: [sourceSchema], default: [] },
  suggestedQuestions: { type: [String], default: [] },
  timestamp: { type: Date, default: Date.now },
});

export default model<IChat>("Chat", chatSchema);
