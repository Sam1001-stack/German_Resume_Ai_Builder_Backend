import fs from "fs";
import path from "path";

const INGEST_URL =
  "http://127.0.0.1:7595/ingest/ca2bfc52-e5c7-43e3-b1f8-d71cc5e992b4";
const LOG_PATH = path.join(process.cwd(), "..", "debug-bd5a5e.log");

type AgentLogPayload = {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
};

export function agentDebugLog(payload: AgentLogPayload): void {
  const entry = {
    sessionId: "bd5a5e",
    timestamp: Date.now(),
    ...payload,
  };

  // #region agent log
  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    /* ignore file write errors */
  }

  fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "bd5a5e",
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
  // #endregion
}
