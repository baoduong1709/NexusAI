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
      transports: ["polling", "websocket"],
    });
  }
  return socketInstance;
};

// A helper map to keep track of debounce timers for query invalidations.
// Using global Record to store setTimeout IDs.
const debounceTimers: Record<string, any> = {};

// Tracking local mutations to avoid redundant refetches on the initiator's side
let lastLocalMutationTime = 0;

export const recordLocalMutation = () => {
  lastLocalMutationTime = Date.now();
  console.log("Real-time: Recorded local mutation at", lastLocalMutationTime);
};

export const isRecentLocalMutation = (threshold = 2000): boolean => {
  const isRecent = Date.now() - lastLocalMutationTime < threshold;
  if (isRecent) {
    console.log(`Real-time: Recent local mutation detected (${Date.now() - lastLocalMutationTime}ms ago)`);
  }
  return isRecent;
};

/**
 * Debounces the invalidation of a query key to avoid spamming the backend API
 * when multiple real-time updates happen in quick succession.
 */
export const debounceInvalidate = (
  queryClient: any,
  queryKey: any[],
  delay = 300
) => {
  const keyStr = JSON.stringify(queryKey);
  if (debounceTimers[keyStr]) {
    clearTimeout(debounceTimers[keyStr]);
  }
  debounceTimers[keyStr] = setTimeout(() => {
    console.log("Real-time: Performing debounced invalidation for key", queryKey);
    queryClient.invalidateQueries({ queryKey });
    delete debounceTimers[keyStr];
  }, delay);
};

export interface WebsocketCallbacks {
  onAiJobStarted?: (data: { jobId: string; projectId: string; type: string }) => void;
  onAiJobCompleted?: (data: { jobId: string; projectId: string; type: string; result: any }) => void;
  onAiJobFailed?: (data: { jobId: string; projectId: string; type: string; error: string }) => void;
}

export function useProjectWebsocket(projectId: string, callbacks?: WebsocketCallbacks) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const socket = getSocket();

    // Connect socket if not connected
    if (!socket.connected) {
      socket.connect();
    }

    // We no longer emit joinProject/leaveProject here because it's handled globally in layout.tsx!
    // This prevents component unmounts from removing the client from the room,
    // which would break the global background updates.
    // socket.emit("joinProject", { projectId });

    // Handle project updates
    const handleProjectUpdated = (data: { projectId: string }) => {
      console.log("Real-time: Project updated, debouncing invalidation", data);
      debounceInvalidate(queryClient, ["project", projectId]);
      debounceInvalidate(queryClient, ["projects"]);
    };

    // Handle tasks updates
    const handleTasksUpdated = (data: { projectId: string }) => {
      console.log("Real-time: Tasks updated, debouncing invalidation", data);
      debounceInvalidate(queryClient, ["project-tasks", projectId]);
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
        debounceInvalidate(queryClient, ["project-tasks", projectId]);
      } else if (data.type === "updateRequirements") {
        // Invalidate requirements
        debounceInvalidate(queryClient, ["requirements", projectId]);
        debounceInvalidate(queryClient, ["req-history", projectId]);
        debounceInvalidate(queryClient, ["project", projectId]);
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
      // socket.emit("leaveProject", { projectId });
      socket.off("projectUpdated", handleProjectUpdated);
      socket.off("tasksUpdated", handleTasksUpdated);
      socket.off("aiJobStarted", handleAiJobStarted);
      socket.off("aiJobCompleted", handleAiJobCompleted);
      socket.off("aiJobFailed", handleAiJobFailed);
    };
  }, [projectId, queryClient, callbacks]);
}
