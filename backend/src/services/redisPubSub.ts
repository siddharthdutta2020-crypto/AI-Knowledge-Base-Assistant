import { createClient, RedisClientType } from "redis";
import { v4 as uuidv4 } from "uuid";

// Channel names — MUST match shared/redis-contract.md exactly.
const CHANNELS = {
  PDF_PROCESS: "pdf:process",
  PDF_PROCESSED: "pdf:processed",
  AI_REQUEST: "ai:request",
  AI_RESPONSE: "ai:response",
};

interface PendingEntry {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

class RedisPubSubService {
  private publisher!: RedisClientType;
  private subscriber!: RedisClientType;
  private pending = new Map<string, PendingEntry>();
  private timeoutMs: number;

  constructor() {
    this.timeoutMs = Number(process.env.AI_RESPONSE_TIMEOUT_MS || 30000);
  }

  async connect(): Promise<void> {
    const url = process.env.REDIS_URL || "redis://localhost:6379";

    this.publisher = createClient({ url });
    this.subscriber = this.publisher.duplicate();

    await this.publisher.connect();
    await this.subscriber.connect();

    await this.subscriber.subscribe(CHANNELS.AI_RESPONSE, (message) =>
      this.handleIncoming(message)
    );

    await this.subscriber.subscribe(CHANNELS.PDF_PROCESSED, (message) =>
      this.handleIncoming(message)
    );

    console.log(
      "[redis] connected, subscribed to ai:response and pdf:processed"
    );
  }

  private handleIncoming(rawMessage: string): void {
    let payload: any;

    try {
      payload = JSON.parse(rawMessage);
    } catch {
      console.error("[redis] failed to parse incoming message");
      return;
    }

    const { requestId } = payload;

    const entry = this.pending.get(requestId);

    if (!entry) {
      return;
    }

    clearTimeout(entry.timeout);

    this.pending.delete(requestId);

    if (payload.error) {
      entry.reject(new Error(payload.error));
    } else {
      entry.resolve(payload);
    }
  }

  private waitForResponse(requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error("AI service did not respond in time (Redis timeout)")
        );
      }, this.timeoutMs);

      this.pending.set(requestId, {
        resolve,
        reject,
        timeout,
      });
    });
  }

  /**
   * Ask AI about ONE specific document.
   */
async askQuestion(
  sessionId: string,
  question: string
): Promise<{
  answer: string;
  sources: { documentName: string; pageNumber?: number }[];
  suggestedQuestions: string[];
}> {

  const requestId = uuidv4();

  const message = JSON.stringify({
    requestId,
    sessionId,
    question,
  });

  const responsePromise = this.waitForResponse(requestId);

  await this.publisher.publish(
    CHANNELS.AI_REQUEST,
    message
  );

  return responsePromise;
}

  /**
   * Ask Python AI service to ingest a PDF.
   */
  async processDocument(
    documentId: string,
    filePath: string,
    fileName: string
  ): Promise<{
    status: string;
    chunkCount: number;
    error: string | null;
  }> {
    const requestId = uuidv4();

    const message = JSON.stringify({
      requestId,
      documentId,
      filePath,
      fileName,
    });

    const responsePromise = this.waitForResponse(requestId);

    await this.publisher.publish(
      CHANNELS.PDF_PROCESS,
      message
    );

    return responsePromise;
  }
}

export const redisPubSub = new RedisPubSubService();