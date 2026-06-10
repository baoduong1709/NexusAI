import * as fs from "fs";
import * as path from "path";

export class AiLogger {
  private static logFilePath = path.join(process.cwd(), "logs", "ai-requests.log");

  /**
   * Logs a request sent to the AI, along with the response, execution duration, and metadata.
   */
  public static log(data: {
    type: "chat" | "chat_stream" | "embeddings" | "summary" | string;
    projectId?: number;
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
      const durationPart = data.durationMs !== undefined ? ` | DURATION: ${data.durationMs}ms` : "";
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

      fs.appendFileSync(this.logFilePath, logMessage, "utf8");
    } catch (err) {
      console.error("Failed to write AI request log:", err);
    }
  }
}
