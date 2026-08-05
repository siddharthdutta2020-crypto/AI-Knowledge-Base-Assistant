import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { connectDB } from "./config/db";
import { redisPubSub } from "./services/redisPubSub";

import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";
import chatRoutes from "./routes/chat";
import dashboardRoutes from "./routes/dashboard";

async function bootstrap() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads")
  )
);


  await connectDB();
  await redisPubSub.connect();

  app.use("/api/auth", authRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Centralized error handler (catches multer errors, etc.)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[unhandled]", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  });

  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`[server] listening on port ${port}`));
}

bootstrap().catch((err) => {
  console.error("[bootstrap] fatal error", err);
  process.exit(1);
});
