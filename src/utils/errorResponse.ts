import mongoose from "mongoose";
import { ApiError } from "./apiError";

const shouldExposeErrors = (): boolean =>
  process.env.EXPOSE_API_ERRORS === "true" ||
  process.env.NODE_ENV !== "production";

export function resolveHttpError(err: Error): {
  statusCode: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ApiError) {
    return { statusCode: err.statusCode, body: { message: err.message } };
  }

  if (err.name === "MongoServerError" && "code" in err && err.code === 11000) {
    return { statusCode: 409, body: { message: "Email is already registered" } };
  }

  const mongoNotReady =
    mongoose.connection.readyState === 0 ||
    err.message.includes("buffering timed out") ||
    err.name === "MongooseError";

  if (mongoNotReady) {
    const body: Record<string, unknown> = {
      message: "Database is not connected. Check MONGODB_URI on the server.",
    };
    if (shouldExposeErrors()) {
      body.errorType = err.name;
      body.details = err.message;
    }
    return { statusCode: 503, body };
  }

  const expose = shouldExposeErrors();
  const body: Record<string, unknown> = {
    message: expose ? err.message : "Internal server error",
  };

  if (expose) {
    body.errorType = err.name;
    body.details = err.message;
  }

  return { statusCode: 500, body };
}
