import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const SOCKET_URL = API_URL.replace("/api", "");

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(`${SOCKET_URL}/ws`, {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket"],
    });
  }
  return socketInstance;
};

export interface WebsocketCallbacks {
  onAiJobStarted?: (data: { jobId: string; projectId: number; type: string }) => void;
  onAiJobCompleted?: (data: { jobId: string; projectId: number; type: string; result: any }) => void;
  onAiJobFailed?: (data: { jobId: string; projectId: number; type: string; error: string }) => void;
}

export function useProjectWebsocket(projectId: number, callbacks?: WebsocketCallbacks) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId || isNaN(projectId)) return;

    const socket = getSocket();

    // Connect socket if not connected
    if (!socket.connected) {
      socket.connect();
    }

    // Join project room
    socket.emit("joinProject", { projectId });

    // Handle project updates
    const handleProjectUpdated = (data: { projectId: number }) => {
      console.log("Real-time: Project updated, invalidating cache", data);
      queryClient.invalidateQueries({
        queryKey: ["project", projectId],
      });
      // Also invalidate projects list
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      toast.info("Project details updated in real-time");
    };

    // Handle tasks updates
    const handleTasksUpdated = (data: { projectId: number }) => {
      console.log("Real-time: Tasks updated, invalidating cache", data);
      queryClient.invalidateQueries({
        queryKey: ["project-tasks", projectId],
      });
      toast.info("Tasks synchronized in real-time");
    };

    // Handle AI Job updates
    const handleAiJobStarted = (data: any) => {
      console.log("Real-time: AI Job started", data);
      callbacks?.onAiJobStarted?.(data);
    };

    const handleAiJobCompleted = (data: any) => {
      console.log("Real-time: AI Job completed", data);
      // Invalidate queries based on job type
      if (data.type === "analyze") {
        queryClient.invalidateQueries({
          queryKey: ["project-tasks", projectId],
        });
      } else if (data.type === "updateRequirements") {
        // Invalidate requirements
        queryClient.invalidateQueries({
          queryKey: ["requirements", projectId],
        });
        queryClient.invalidateQueries({
          queryKey: ["req-history", projectId],
        });
        queryClient.invalidateQueries({
          queryKey: ["project", projectId],
        });
      }
      callbacks?.onAiJobCompleted?.(data);
    };

    const handleAiJobFailed = (data: any) => {
      console.log("Real-time: AI Job failed", data);
      callbacks?.onAiJobFailed?.(data);
    };

    socket.on("projectUpdated", handleProjectUpdated);
    socket.on("tasksUpdated", handleTasksUpdated);
    socket.on("aiJobStarted", handleAiJobStarted);
    socket.on("aiJobCompleted", handleAiJobCompleted);
    socket.on("aiJobFailed", handleAiJobFailed);

    // Clean up
    return () => {
      socket.emit("leaveProject", { projectId });
      socket.off("projectUpdated", handleProjectUpdated);
      socket.off("tasksUpdated", handleTasksUpdated);
      socket.off("aiJobStarted", handleAiJobStarted);
      socket.off("aiJobCompleted", handleAiJobCompleted);
      socket.off("aiJobFailed", handleAiJobFailed);
    };
  }, [projectId, queryClient, callbacks]);
}
