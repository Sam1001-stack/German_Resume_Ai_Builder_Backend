import fs from "fs";
import path from "path";
import multer from "multer";

const TEMP_DIR = path.join(process.cwd(), "uploads", "recruiter-temp");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.\-]+/g, "_")}`);
  },
});

function pdfFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
    cb(null, true);
    return;
  }
  cb(new Error("Only PDF files are allowed"));
}

export const uploadResumesMiddleware = multer({
  storage,
  fileFilter: pdfFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 25,
  },
});
