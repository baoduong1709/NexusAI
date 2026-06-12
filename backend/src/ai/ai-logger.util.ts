import * as fs from "fs";
import * as path from "path";

export class AiLogger {
  private static logFilePath = path.join(process.cwd(), "logs", "ai-requests.log");
  private static buffer: string[] = [];
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly FLUSH_INTERVAL_MS = 5000; // flush every 5 seconds
  private static readonly MAX_BUFFER_SIZE = 50;     // or when 50 entries queued
  private static isFlushing = false;

  /**
   * Enqueue a log entry; flushed asynchronously in batches.
   * Identical public API — callers don't change.
   */
  public static log(data: {
    type: "chat" | "chat_stream" | "embeddings" | "summary" | string;
    projectId?: string;
    userId?: number;
    request: any;
    response?: any;
    error?: any;
    durationMs?: number;
  }) {
    try {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const timestamp = new Date().toISOString();
      const projectPart = data.projectId ? ` | PROJECT: ${data.projectId}` : "";
      const userPart = data.userId ? ` | USER: ${data.userId}` : "";
      const durationPart =
        data.durationMs !== undefined ? ` | DURATION: ${data.durationMs}ms` : "";
      const statusPart = data.error ? " | ERROR" : " | SUCCESS";

      let logMessage = `[${timestamp}] TYPE: ${data.type.toUpperCase()}${projectPart}${userPart}${durationPart}${statusPart}\n`;

      logMessage += `REQUEST:\n${
        typeof data.request === "string"
          ? data.request
          : JSON.stringify(data.request, null, 2)
      }\n`;

      if (data.response !== undefined) {
        logMessage += `RESPONSE:\n${
          typeof data.response === "string"
            ? data.response
            : JSON.stringify(data.response, null, 2)
        }\n`;
      }

      if (data.error) {
        logMessage += `ERROR DETAIL:\n${
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error, null, 2)
        }\n`;
      }

      logMessage += `----------------------------------------------------------------------\n`;

      this.buffer.push(logMessage);

      // Flush immediately if buffer is full, otherwise schedule
      if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
        this.flush();
      } else {
        this.scheduleFlush();
      }
    } catch (err) {
      console.error("Failed to buffer AI request log:", err);
    }
  }

  private static scheduleFlush() {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  private static async flush() {
    if (this.isFlushing) return; // skip if a flush is already in progress
    if (this.buffer.length === 0) return;

    this.isFlushing = true;

    // Clear the timer since we're flushing now
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = this.buffer.splice(0); // drain atomically
    try {
      await fs.promises.appendFile(this.logFilePath, batch.join(""), "utf8");
    } catch (err) {
      console.error("Failed to write AI request log:", err);
      // Re-queue the batch so we don't lose logs
      this.buffer.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }
}
