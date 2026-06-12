"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  Users,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Cpu,
  Building2,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  permission?: string | ((hasPermission: (p: string) => boolean) => boolean);
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "user:read" },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Users", href: "/users", icon: Users, permission: "user:read" },
  { name: "Roles", href: "/roles", icon: Settings, permission: "role:read" },
  {
    name: "AI Settings",
    href: "/ai-settings",
    icon: Cpu,
    permission: (hasPermission) =>
      hasPermission("token:read") ||
      hasPermission("system:config:read") ||
      hasPermission("system:config:write"),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, hasPermission } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [currentWorkspace] = useState({
    name: "NexusAI Org",
    plan: "Enterprise",
  });

  // Load collapse preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar-collapsed", String(nextState));
  };

  // Filter navigation items based on user permissions
  const visibleNavigation = navigation.filter((item) => {
    if (!item.permission) return true;
    if (typeof item.permission === "function") {
      return item.permission(hasPermission);
    }
    return hasPermission(item.permission);
  });

  return (
    <aside
      className={cn(
        "h-[calc(100vh-2rem)] my-4 ml-4 flex flex-col bg-zinc-950/80 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl relative overflow-visible transition-all duration-300 ease-in-out z-30",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Workspace Switcher / Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-white/5 relative">
        {!isCollapsed ? (
          <div className="w-full">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="w-full flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/20">
                <Building2 size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate flex items-center gap-1">
                  {currentWorkspace.name}
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded uppercase font-bold tracking-wider">
                    PRO
                  </span>
                </p>
                <p className="text-xs text-zinc-500 truncate">{currentWorkspace.plan}</p>
              </div>
              <ChevronsUpDown size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </button>
            
            {/* Simple Dropdown Menu Mock */}
            <AnimatePresence>
              {showWorkspaceMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-4 right-4 top-14 mt-2 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-50"
                >
                  <p className="text-[10px] font-bold text-zinc-500 px-2.5 py-1.5 uppercase tracking-wider">
                    Workspaces
                  </p>
                  <button className="w-full flex items-center gap-2 p-2 rounded-xl bg-white/5 text-left text-sm text-white">
                    <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                      N
                    </div>
                    NexusAI Org
                  </button>
                  <button className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 text-left text-sm text-zinc-400 hover:text-white transition-all mt-1">
                    <div className="w-6 h-6 rounded-md bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                      P
                    </div>
                    Personal Space
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <button
              onClick={toggleCollapse}
              className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all group relative"
            >
              <BrandLogo size={24} />
              <span className="absolute left-14 bg-zinc-900 border border-white/10 text-xs text-zinc-200 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md">
                NexusAI Org
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {visibleNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative overflow-visible",
                isActive
                  ? "text-white bg-white/5"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5"
              )}
            >
              {/* Active Indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="activeSidebarIndicator"
                  className={cn(
                    "absolute bg-indigo-500 rounded-full",
                    isCollapsed ? "left-1 top-3 bottom-3 w-1" : "left-0 top-2.5 bottom-2.5 w-1"
                  )}
                />
              )}

              <item.icon
                size={18}
                className={cn(
                  "transition-transform duration-200 group-hover:scale-105 shrink-0",
                  isActive
                    ? "text-indigo-400"
                    : "text-zinc-500 group-hover:text-zinc-300"
                )}
              />
              
              {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}

              {/* Tooltip for Collapsed Sidebar */}
              {isCollapsed && (
                <span className="absolute left-16 bg-zinc-900 border border-white/10 text-xs text-zinc-200 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-md z-50"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logout Button */}
      <div className="p-3 border-t border-white/5 mt-auto">
        <button
          onClick={logout}
          className={cn(
            "w-full group flex items-center rounded-xl text-sm font-medium transition-all duration-200 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10",
            isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5"
          )}
        >
          <LogOut
            size={18}
            className="transition-transform duration-200 group-hover:translate-x-0.5 shrink-0"
          />
          {!isCollapsed && <span className="flex-1 text-left">Logout</span>}
          
          {isCollapsed && (
            <span className="absolute left-16 bg-zinc-900 border border-white/10 text-xs text-rose-400 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md">
              Logout
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
