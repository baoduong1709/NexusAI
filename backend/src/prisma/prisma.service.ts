import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger("Prisma");

  constructor() {
    super({
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
    });
  }

  async onModuleInit() {
    (this as any).$on("query", (e: any) => {
      this.logger.debug(
        `Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`,
      );
    });
    (this as any).$on("error", (e: any) => {
      this.logger.error(`DB Error: ${e.message}`);
    });
    (this as any).$on("warn", (e: any) => {
      this.logger.warn(`DB Warning: ${e.message}`);
    });
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
