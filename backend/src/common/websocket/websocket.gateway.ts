import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: (requestOrigin: string, callback: (err: Error | null, allow?: any) => void) => {
      // Dynamic origin reflection allows withCredentials to work correctly
      callback(null, requestOrigin || "*");
    },
    credentials: true,
  },
  namespace: "ws",
})
@Injectable()
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("joinProject")
  handleJoinProject(client: Socket, payload: { projectId: string }) {
    const roomId = `project:${payload.projectId}`;
    client.join(roomId);
    this.logger.log(`Client ${client.id} joined room ${roomId}`);
    return { event: "joined", room: roomId };
  }

  @SubscribeMessage("leaveProject")
  handleLeaveProject(client: Socket, payload: { projectId: string }) {
    const roomId = `project:${payload.projectId}`;
    client.leave(roomId);
    this.logger.log(`Client ${client.id} left room ${roomId}`);
    return { event: "left", room: roomId };
  }

  @SubscribeMessage("joinUser")
  handleJoinUser(client: Socket, payload: { userId: number }) {
    const roomId = `user:${payload.userId}`;
    client.join(roomId);
    this.logger.log(`Client ${client.id} joined user room ${roomId}`);
    return { event: "joined", room: roomId };
  }

  @SubscribeMessage("leaveUser")
  handleLeaveUser(client: Socket, payload: { userId: number }) {
    const roomId = `user:${payload.userId}`;
    client.leave(roomId);
    this.logger.log(`Client ${client.id} left user room ${roomId}`);
    return { event: "left", room: roomId };
  }

  notifyProjectUpdate(projectId: string, event: string, payload: any) {
    const roomId = `project:${projectId}`;
    this.logger.log(`Broadcasting event "${event}" to room "${roomId}"`);
    this.server.to(roomId).emit(event, payload);
  }

  notifyUser(userId: number, event: string, payload: any) {
    const roomId = `user:${userId}`;
    this.logger.log(`Sending event "${event}" to user room "${roomId}"`);
    this.server.to(roomId).emit(event, payload);
  }
}
