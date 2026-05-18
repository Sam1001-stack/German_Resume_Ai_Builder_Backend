import "dotenv/config";

import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import connectDB from "./config/db";
import resumeRoutes from "./routes/resumeRoutes";

const app = express();
const PORT = process.env.PORT || 5000;

void connectDB();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "German Resume AI Builder API" });
});

app.use("/api/resumes", resumeRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
