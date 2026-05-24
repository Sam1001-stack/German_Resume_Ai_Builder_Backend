import "dotenv/config";

import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import connectDB from "./config/db";
import aiRoutes from "./routes/aiRoutes";
import authRoutes from "./routes/authRoutes";
import resumeRoutes from "./routes/resumeRoutes";
import userResumeRoutes from "./routes/userResumeRoutes";
import { ApiError } from "./utils/apiError";

const app = express();
const PORT = process.env.PORT || 5001;

void connectDB();

console.log(process.env.CLIENT_URL);

app.use(
  cors({
   // origin: process.env.CLIENT_URL || "http://localhost:3000",
    origin: "http://localhost:3000",
    credentials: true,

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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
