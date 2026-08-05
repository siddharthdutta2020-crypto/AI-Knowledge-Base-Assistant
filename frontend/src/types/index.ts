export interface DocumentItem {
  _id: string;
  fileName: string;
  filePath: string;
  uploadDate: string;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  chunkCount?: number;
  error?: string | null;
}

export interface Source {
  documentName: string;
  pageNumber?: number;
}

export interface ChatMessage {
  _id?: string;
  sessionId: string;
  question: string;
  answer: string;
  sources: Source[];
  suggestedQuestions: string[];
  timestamp?: string;
}

export interface DashboardStats {
  totalUploadedPdfs: number;
  totalChatSessions: number;
  totalQuestionsAsked: number;
  recentUploadedDocuments: DocumentItem[];
}
