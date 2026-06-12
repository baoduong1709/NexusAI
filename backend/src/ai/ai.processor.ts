import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { AiService } from "./ai.service";
import { WebsocketGateway } from "../common/websocket/websocket.gateway";

@Processor("ai")
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { projectId, userId } = job.data;
    const jobId = job.id;

    this.logger.log(`Processing job ${jobId} of type ${job.name} for project ${projectId}`);

    // Notify clients that job has started
    this.websocketGateway.notifyProjectUpdate(projectId, "aiJobStarted", {
      jobId,
      projectId,
      type: job.name,
    });

    try {
      let result;
      if (job.name === "analyze") {
        result = await this.aiService.analyzeProject(projectId, userId);
      } else if (job.name === "updateRequirements") {
        result = await this.aiService.updateRequirements(projectId, userId);
      } else {
        throw new Error(`Unknown job name: ${job.name}`);
      }

      // Notify clients of job completion
      this.websocketGateway.notifyProjectUpdate(projectId, "aiJobCompleted", {
        jobId,
        projectId,
        type: job.name,
        result,
      });

      return result;
    } catch (error: any) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`, error.stack);

      // Notify clients of job failure
      this.websocketGateway.notifyProjectUpdate(projectId, "aiJobFailed", {
        jobId,
        projectId,
        type: job.name,
        error: error.message || "An unexpected error occurred",
      });

      throw error;
    }
  }
}
