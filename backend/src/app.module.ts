import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { CacheModule } from "@nestjs/cache-manager";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { ProjectsModule } from "./projects/projects.module";
import { TasksModule } from "./tasks/tasks.module";
import { DocumentsModule } from "./documents/documents.module";
import { AiModule } from "./ai/ai.module";
import { LoggingMiddleware } from "./common/middleware/logging.middleware";
import { StorageModule } from "./common/storage/storage.module";
import { WebsocketModule } from "./common/websocket/websocket.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limiting: 100 requests per 60 seconds
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule.register({
      isGlobal: true,
      ttl: 10000, // 10 seconds
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 6379),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,

    AuthModule,
    UsersModule,
    RolesModule,
    ProjectsModule,
    TasksModule,
    DocumentsModule,
    AiModule,
    StorageModule,
    WebsocketModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes("*");
  }
}
