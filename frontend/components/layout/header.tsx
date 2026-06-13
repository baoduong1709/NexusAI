"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  LogOut,
  User,
  Sun,
  Moon,
  Bell,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  Command,
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  Cpu,
  ArrowRight,
  Hash,
} from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import { authApi, notificationsApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquare, AlertCircle, Sparkles } from "lucide-react";

// ─── Search / Quick nav items ─────────────────────────────────────────────────

interface QuickNavItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: any;
  keywords: string[];
}

const quickNavItems: QuickNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Overview & analytics",
    href: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["dashboard", "home", "overview", "trang chủ"],
  },
  {
    id: "projects",
    label: "Projects",
    description: "Manage workspace projects",
    href: "/projects",
    icon: FolderKanban,
    keywords: ["projects", "dự án", "task", "kanban"],
  },
  {
    id: "users",
    label: "Users",
    description: "Team members & accounts",
    href: "/users",
    icon: Users,
    keywords: ["users", "members", "thành viên", "người dùng"],
  },
  {
    id: "roles",
    label: "Roles",
    description: "Permissions & access control",
    href: "/roles",
    icon: Settings,
    keywords: ["roles", "permissions", "quyền", "phân quyền"],
  },
  {
    id: "ai-settings",
    label: "AI Settings",
    description: "Configure AI models",
    href: "/ai-settings",
    icon: Cpu,
    keywords: ["ai", "settings", "cài đặt", "model", "token"],
  },
];

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [personalToken, setPersonalToken] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiresIn, setExpiresIn] = useState("365d");

  // Notifications logic
  const queryClient = useQueryClient();
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getAll().then((r) => r.data),
    enabled: !!user,
  });

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = notificationsData?.unreadCount ?? 0;

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Relative time formatter for premium UI look
  const formatRelativeTime = (dateStr: string | Date) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Vừa xong";
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay === 1) return "Hôm qua";
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();

  // Derive page title from pathname
  const getPageInfo = () => {
    const segments = pathname.split("/").filter(Boolean);
    const page = segments[0] || "dashboard";
    const titles: Record<string, { title: string; subtitle: string }> = {
      dashboard: { title: "Dashboard", subtitle: "Overview & analytics" },
      projects: { title: "Projects", subtitle: "Manage workspace projects" },
      users: { title: "Users", subtitle: "Team members & accounts" },
      roles: { title: "Roles", subtitle: "Permissions & access control" },
      "ai-settings": {
        title: "AI Settings",
        subtitle: "Configure AI models",
      },
    };
    return (
      titles[page] || {
        title: page.charAt(0).toUpperCase() + page.slice(1),
        subtitle: "",
      }
    );
  };

  const pageInfo = getPageInfo();

  // Build breadcrumb from pathname
  const breadcrumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((seg, idx, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
      href: "/" + arr.slice(0, idx + 1).join("/"),
      isLast: idx === arr.length - 1,
    }));

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // ── Search logic ──────────────────────────────────────────────────────────

  const filteredItems = quickNavItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
    );
  });

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    setSearchQuery("");
    setSelectedIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSelectedIndex(0);
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      closeSearch();
      router.push(href);
    },
    [closeSearch, router]
  );

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isSearchOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if (e.key === "Escape" && isSearchOpen) {
        closeSearch();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSearchOpen, closeSearch, openSearch]);

  // Handle arrow keys & enter in search
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredItems.length - 1
      );
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      navigateTo(filteredItems[selectedIndex].href);
    }
  };

  // ── Token modal logic ─────────────────────────────────────────────────────

  const handleOpenTokenModal = () => {
    setIsTokenModalOpen(true);
    setPersonalToken("");
    setIsCopied(false);
    setIsTokenVisible(false);
    setExpiresIn("365d");
  };

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      const res = await authApi.generatePersonalToken(expiresIn);
      setPersonalToken(res.data.token);
      setIsCopied(false);
    } catch (error) {
      console.error("Failed to generate token", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(personalToken);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <header className="h-14 px-6 flex items-center justify-between sticky top-0 z-40 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-b border-zinc-200/50 dark:border-white/5">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-zinc-300 dark:text-zinc-600 text-xs">/</span>
            )}
            {crumb.isLast ? (
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={() => router.push(crumb.href)}
                className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors truncate max-w-[120px] cursor-pointer"
              >
                {crumb.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Center: Search Bar */}
      <button
        onClick={openSearch}
        className="hidden md:flex items-center gap-2 bg-zinc-100/80 dark:bg-zinc-800/50 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 border border-zinc-200/60 dark:border-white/5 rounded-lg px-3 py-1.5 transition-all group cursor-pointer min-w-[240px] max-w-[320px]"
      >
        <Search
          size={14}
          className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors flex-shrink-0"
        />
        <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-1 text-left">
          Search...
        </span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-white/80 dark:bg-zinc-700/50 border border-zinc-200/80 dark:border-zinc-600/50 rounded px-1.5 py-0.5">
          <Command size={10} />K
        </kbd>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Mobile search trigger */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openSearch}
          className="md:hidden p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
        >
          <Search size={16} />
        </motion.button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsNotiOpen(!isNotiOpen)}
            className="relative p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-zinc-950" />
            )}
          </motion.button>

          <AnimatePresence>
            {isNotiOpen && (
              <>
                {/* Backdrop to close on click outside */}
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsNotiOpen(false)}
                />

                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-[calc(100%+4px)] w-80 sm:w-96 bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xl py-3 z-50 overflow-hidden font-sans"
                >
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between px-4 pb-2 border-b border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Thông báo</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                          {unreadCount} mới
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsReadMutation.mutate()}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-750 hover:underline cursor-pointer"
                      >
                        Đọc tất cả
                      </button>
                    )}
                  </div>

                  {/* Dropdown Content */}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 dark:text-zinc-600 mb-3">
                          <Bell size={20} className="opacity-80" />
                        </div>
                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Không có thông báo nào</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Các thông báo mới về công việc sẽ xuất hiện ở đây.</p>
                      </div>
                    ) : (
                      notifications.map((noti: any) => {
                        const isUnread = !noti.isRead;
                        // Select icon and color based on notification type
                        let IconComponent = Bell;
                        let iconColorClass = "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
                        
                        if (noti.type === "LINK_TASK_STATUS_CHANGED") {
                          IconComponent = CheckCircle2;
                          iconColorClass = "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
                        } else if (noti.type === "AI_JOB") {
                          IconComponent = Sparkles;
                          iconColorClass = "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400";
                        } else if (noti.type === "SYSTEM") {
                          IconComponent = AlertCircle;
                          iconColorClass = "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400";
                        }

                        return (
                          <div
                            key={noti.id}
                            onClick={async () => {
                              if (isUnread) {
                                markAsReadMutation.mutate(noti.id);
                              }
                              setIsNotiOpen(false);
                              if (noti.link) {
                                router.push(noti.link);
                              }
                            }}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer text-left relative",
                              isUnread && "bg-indigo-50/20 dark:bg-indigo-500/[0.02]"
                            )}
                          >
                            {/* Icon Wrapper */}
                            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", iconColorClass)}>
                              <IconComponent size={15} />
                            </div>

                            {/* Message Area */}
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-snug", isUnread && "font-bold text-zinc-950 dark:text-white")}>
                                {noti.title}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-normal break-words">
                                {noti.message}
                              </p>
                              <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1.5 font-medium">
                                {formatRelativeTime(noti.createdAt)}
                              </p>
                            </div>

                            {/* Unread indicator */}
                            {isUnread && (
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0 mt-2 ml-1" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Dark/Light mode toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
          title="Toggle Theme"
        >
          <div className="transition-transform duration-300">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </div>
        </motion.button>

        <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />

        {/* User Profile */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2.5 text-left focus:outline-none cursor-pointer rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 px-2 py-1 transition-all"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-none">
                {user?.name}
              </p>
              <p className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 mt-0.5">
                {user?.role?.name || "Member"}
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold rounded-lg w-8 h-8 flex items-center justify-center text-[11px] shadow-md shadow-indigo-500/20 ring-1 ring-white/50 dark:ring-white/10">
              {user?.name ? getInitials(user.name) : <User size={14} />}
            </div>
          </motion.button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <>
                {/* Backdrop to close on click outside */}
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsMenuOpen(false)}
                />

                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-[calc(100%+4px)] w-48 bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl shadow-xl py-1.5 z-50 overflow-hidden"
                >
                  {/* User info for mobile view inside dropdown */}
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 sm:hidden">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-none truncate">
                      {user?.name}
                    </p>
                    <p className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {user?.role?.name || "Member"}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleOpenTokenModal();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left font-medium cursor-pointer"
                  >
                    <Key size={14} />
                    <span>API Token (MCP)</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 transition-all text-left font-medium cursor-pointer border-t border-zinc-100 dark:border-zinc-800/50"
                  >
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Command Palette / Search Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeSearch}
              className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            />

            {/* Search Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
                <Search
                  size={16}
                  className="text-zinc-400 dark:text-zinc-500 flex-shrink-0"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search pages, actions..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
                <kbd className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="py-2 max-h-[320px] overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-zinc-400 dark:text-zinc-500">
                      No results found
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Pages
                      </p>
                    </div>
                    {filteredItems.map((item, idx) => {
                      const Icon = item.icon;
                      const isActive = idx === selectedIndex;
                      const isCurrent = pathname.startsWith(item.href);
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigateTo(item.href)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer",
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-500/10"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                              isActive
                                ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                            )}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isActive
                                  ? "text-indigo-700 dark:text-indigo-300"
                                  : "text-zinc-800 dark:text-zinc-200"
                              )}
                            >
                              {item.label}
                            </p>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                              {item.description}
                            </p>
                          </div>
                          {isCurrent && (
                            <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                          {isActive && (
                            <ArrowRight
                              size={14}
                              className="text-indigo-400 dark:text-indigo-500 flex-shrink-0"
                            />
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center gap-1">
                  <kbd className="bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5 border border-zinc-200 dark:border-zinc-700 font-mono">
                    ↑↓
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5 border border-zinc-200 dark:border-zinc-700 font-mono">
                    ↵
                  </kbd>
                  Open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5 border border-zinc-200 dark:border-zinc-700 font-mono">
                    esc
                  </kbd>
                  Close
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Personal Access Token Modal */}
      <AnimatePresence>
        {isTokenModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTokenModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative z-10 overflow-hidden font-sans"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-500/10 dark:bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-550">
                    Personal API Token (MCP)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Dùng để cấu hình AI local (Cursor, Claude Desktop...)
                  </p>
                </div>
              </div>

              <div className="space-y-4 my-5">
                <p className="text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed">
                  Token này cấp quyền truy cập API của NexusAI dưới danh nghĩa
                  tài khoản của bạn. Vui lòng bảo mật kỹ token này.
                </p>

                {personalToken ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                      Token của bạn
                    </label>
                    <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 gap-2">
                      <input
                        type={isTokenVisible ? "text" : "password"}
                        value={personalToken}
                        readOnly
                        className="bg-transparent border-none outline-none flex-1 text-xs text-zinc-800 dark:text-zinc-100 font-mono select-all pr-16"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        <button
                          onClick={() => setIsTokenVisible(!isTokenVisible)}
                          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
                          title={isTokenVisible ? "Ẩn token" : "Hiện token"}
                        >
                          {isTokenVisible ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                        <button
                          onClick={handleCopyToken}
                          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors flex items-center justify-center cursor-pointer"
                          title="Sao chép token"
                        >
                          {isCopied ? (
                            <Check
                              size={14}
                              className="text-emerald-500 animate-scale-in"
                            />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4 px-6 flex flex-col border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20">
                    <div className="w-full space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                        Chọn thời gian hiệu lực
                      </label>
                      <select
                        value={expiresIn}
                        onChange={(e) => setExpiresIn(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-250 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        <option value="7d">7 ngày (Ngắn hạn)</option>
                        <option value="30d">30 ngày</option>
                        <option value="90d">90 ngày</option>
                        <option value="365d">1 năm (Mặc định)</option>
                        <option value="never">Vô hạn (Không hết hạn)</option>
                      </select>
                    </div>

                    <div className="flex justify-center pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGenerateToken}
                        disabled={isGenerating}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isGenerating ? "Đang tạo..." : "Tạo Token Mới"}
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  onClick={() => setIsTokenModalOpen(false)}
                  className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 text-sm font-semibold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
