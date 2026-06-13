import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { WebsocketModule } from "../common/websocket/websocket.module";

@Module({
  imports: [PrismaModule, WebsocketModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
