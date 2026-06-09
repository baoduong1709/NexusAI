"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  Users,
  LogOut,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Users", href: "/users", icon: Users },
  { name: "Roles", href: "/roles", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="w-64 h-[calc(100vh-2rem)] my-4 ml-4 flex flex-col bg-card/80 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
      {/* Brand area */}
      <div className="h-20 flex items-center px-8 border-b border-white/5">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">
            NexusAI
          </span>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 relative overflow-hidden",
                isActive
                  ? "text-zinc-900 dark:text-white bg-zinc-900/5 dark:bg-zinc-900/5 shadow-inner"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/[0.02]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSidebar"
                  className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-500 rounded-r-full"
                />
              )}

              <item.icon
                size={18}
                className={cn(
                  "transition-transform duration-200 group-hover:scale-110",
                  isActive
                    ? "text-indigo-500 dark:text-indigo-400"
                    : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                )}
              />
              <span className="flex-1 tracking-wide">{item.name}</span>
              {isActive && (
                <ChevronRight
                  size={14}
                  className="text-indigo-400 dark:text-indigo-500 animate-pulse"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Model info footer */}
      <div className="p-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900/5 border border-zinc-100 dark:border-white/10">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
            <Sparkles size={14} className="animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 leading-none">
              POWERED BY
            </p>
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-1">
              Gemma LLM
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
