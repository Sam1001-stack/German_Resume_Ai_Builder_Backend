import "dotenv/config";

import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import mongoose from "mongoose";
import connectDB from "./config/db";
import aiRoutes from "./routes/aiRoutes";
import authRoutes from "./routes/authRoutes";
import resumeRoutes from "./routes/resumeRoutes";
import userResumeRoutes from "./routes/userResumeRoutes";
import { agentDebugLog } from "./utils/agentDebugLog";
import { resolveHttpError } from "./utils/errorResponse";

const app = express();
const PORT = process.env.PORT || 5000;

console.log(process.env.CLIENT_URL + " client url" + PORT + " port");

app.use(
  cors({
    // origin: [
    //  process.env.CLIENT_URL as string || "http://localhost:3000" as string,
    //    "http://localhost:3000" as string
    //   ],

    origin: "*",
    credentials: true
  })
);
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "German Resume AI Builder API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/user-resumes", userResumeRoutes);
app.use("/api/resumes", resumeRoutes);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const { statusCode, body } = resolveHttpError(err);

  // #region agent log
  agentDebugLog({
    location: "index.ts:errorHandler",
    message: "Unhandled route error",
    hypothesisId: "H1-H5",
    data: {
      path: req.path,
      method: req.method,
      statusCode,
      errorName: err.name,
      errorMessage: err.message,
      mongoReadyState: mongoose.connection.readyState,
    },
  });
  // #endregion

  console.error(`[API Error] ${req.method} ${req.path}`, err);
  res.status(statusCode).json(body);
});

async function startServer() {
  await connectDB();

  // #region agent log
  agentDebugLog({
    location: "index.ts:startServer",
    message: "Server starting",
    hypothesisId: "H2",
    data: {
      hasMongoUri: Boolean(process.env.MONGODB_URI),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      nodeEnv: process.env.NODE_ENV ?? "undefined",
    },
  });
  // #endregion

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

void startServer();
