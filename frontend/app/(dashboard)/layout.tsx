"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import AiChatBubble from "@/components/ai-chat-bubble";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

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
