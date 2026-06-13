"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import AiChatBubble from "@/components/ai-chat-bubble";
import { Loader2 } from "lucide-react";
import { getSocket, debounceInvalidate, isRecentLocalMutation } from "@/lib/websocket";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi, notificationsApi } from "@/lib/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch the projects user belongs to, so we can join their websocket rooms globally
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();

    // Helper to join all required socket rooms
    const joinAllRooms = () => {
      console.log("Socket: Joining user and project rooms globally");
      // Join personal user room to receive targeted notifications
      socket.emit("joinUser", { userId: user.id });

      // Join rooms for all projects this user is a member of
      const projectIds = projects.map((p: any) => p.id);
      projectIds.forEach((projectId: string) => {
        socket.emit("joinProject", { projectId });
        console.log(`Socket: Global join project room project:${projectId}`);
      });
    };

    // If socket is already connected, join rooms immediately.
    // Otherwise, it will join on the 'connect' event.
    if (socket.connected) {
      joinAllRooms();
    } else {
      socket.connect();
    }

    // Attach connect event listener so that rooms are joined again after reconnection
    socket.on("connect", joinAllRooms);

    const handleNewNotification = (notification: any) => {
      console.log("Real-time notification: newNotification", notification);
      
      // Invalidate notifications query to refresh the list & badge count
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      // Premium, silent-sync design: show clean toast notification with redirect action
      toast.info(notification.message, {
        description: notification.title,
        duration: 6000,
        action: notification.link ? {
          label: "Xem",
          onClick: async () => {
            try {
              await notificationsApi.markAsRead(notification.id);
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
            } catch (err) {
              console.error("Failed to mark notification as read from toast", err);
            }
            router.push(notification.link);
          },
        } : undefined,
      });
    };

    // Global listener for project details updates
    const handleProjectUpdatedGlobal = (data: { projectId: string }) => {
      console.log("Socket Global: Project updated", data);
      if (isRecentLocalMutation()) {
        console.log("Socket Global: Ignored project update due to recent local mutation");
        return;
      }
      debounceInvalidate(queryClient, ["project", data.projectId], 300);
      debounceInvalidate(queryClient, ["projects"], 300);
    };

    // Global listener for tasks updates
    const handleTasksUpdatedGlobal = (data: { projectId: string }) => {
      console.log("Socket Global: Tasks updated", data);
      if (isRecentLocalMutation()) {
        console.log("Socket Global: Ignored tasks update due to recent local mutation");
        return;
      }
      debounceInvalidate(queryClient, ["project-tasks", data.projectId], 300);
      debounceInvalidate(queryClient, ["projects"], 300); // Update dashboard/stats as well
    };

    socket.on("newNotification", handleNewNotification);
    socket.on("projectUpdated", handleProjectUpdatedGlobal);
    socket.on("tasksUpdated", handleTasksUpdatedGlobal);

    return () => {
      // Leave user room
      socket.emit("leaveUser", { userId: user.id });
      
      // Leave all project rooms
      const projectIds = projects.map((p: any) => p.id);
      projectIds.forEach((projectId: string) => {
        socket.emit("leaveProject", { projectId });
      });

      socket.off("connect", joinAllRooms);
      socket.off("newNotification", handleNewNotification);
      socket.off("projectUpdated", handleProjectUpdatedGlobal);
      socket.off("tasksUpdated", handleTasksUpdatedGlobal);
    };
  }, [user, projects, router, queryClient]);

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <Loader2 className='animate-spin text-blue-600' size={32} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background dark:bg-grid-white/[0.02] bg-grid-black/[0.02] relative overflow-hidden font-sans">
      {/* Animated Aurora Backgrounds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-[40vw] h-[40vw] bg-indigo-500/[0.07] dark:bg-indigo-500/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-aurora-1" />
        <div className="absolute w-[50vw] h-[50vw] bg-violet-500/[0.07] dark:bg-violet-500/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-aurora-2" />
        <div className="absolute w-[30vw] h-[30vw] bg-fuchsia-500/[0.04] dark:bg-fuchsia-500/5 rounded-full blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-aurora-3" />
      </div>
      
      {/* Grid Mask */}
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_10%,black_80%)] z-0" />

      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="w-full h-full px-6 pt-4 pb-6">
            {children}
          </div>
        </main>
      </div>
      
      <div className="relative z-50">
        <AiChatBubble />
      </div>
    </div>
  );
}
