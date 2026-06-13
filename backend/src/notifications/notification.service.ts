import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../common/websocket/websocket.gateway";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /**
   * Creates a notification, stores it in the database, and emits it to the user via WebSocket.
   */
  async create(userId: number, data: { title: string; message: string; type: string; link?: string }) {
    this.logger.log(`Creating notification for user ${userId}: ${data.title}`);

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
      },
    });

    // Emit real-time notification to the user's personal WebSocket room
    this.websocketGateway.notifyUser(userId, "newNotification", notification);

    return notification;
  }

  /**
   * Fetches the latest 50 notifications for a user, along with the total unread count.
   */
  async findAll(userId: number) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(userId: number, notificationId: number) {
    // Ensure the notification belongs to the user before updating
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found or unauthorized");
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Marks all unread notifications of a user as read.
   */
  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
