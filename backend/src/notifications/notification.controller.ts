import { Controller, Get, Patch, Post, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: "Get latest notifications for current user" })
  @Get()
  async getNotifications(@CurrentUser() user: any) {
    return this.notificationService.findAll(user.id);
  }

  @ApiOperation({ summary: "Mark a notification as read" })
  @Patch(":id/read")
  async markAsRead(@CurrentUser() user: any, @Param("id", ParseIntPipe) id: number) {
    return this.notificationService.markAsRead(user.id, id);
  }

  @ApiOperation({ summary: "Mark all notifications as read" })
  @Post("read-all")
  async markAllAsRead(@CurrentUser() user: any) {
    await this.notificationService.markAllAsRead(user.id);
    return { success: true, message: "All notifications marked as read" };
  }
}
