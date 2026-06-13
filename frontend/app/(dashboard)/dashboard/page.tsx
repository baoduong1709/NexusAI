"use client";

import { useQuery } from "@tanstack/react-query";
import { projectsApi, usersApi } from "@/lib/api";
import { FolderKanban, Users, CheckCircle, Clock, Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatDate, PROJECT_STATUS_COLORS, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  
  if (!hasPermission("user:read")) {
    router.replace("/projects");
    return null;
  }

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
    enabled: hasPermission("user:read"), // Only fetch projects if user has user:read
  });
  
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll().then((r) => r.data),
    enabled: hasPermission("user:read"), // Only fetch users if user has user:read
  });

  const stats = [
    {
      label: "Total Projects",
      value: projects?.length ?? "-",
      icon: FolderKanban,
      color: "from-blue-500/20 to-blue-500/5 text-blue-500 dark:text-blue-400",
      href: "/projects",
    },
    {
      label: "Active Projects",
      value: projects?.filter((p: any) => p.status === "ACTIVE").length ?? "-",
      icon: Clock,
      color: "from-amber-500/20 to-amber-500/5 text-amber-500 dark:text-amber-400",
      href: "/projects",
    },
    {
      label: "Users / Members",
      value: users?.length ?? "-",
      icon: Users,
      color: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 dark:text-emerald-400",
      href: "/users",
    },
    {
      label: "Completed Projects",
      value: projects?.filter((p: any) => p.status === "COMPLETED").length ?? "-",
      icon: CheckCircle,
      color: "from-indigo-500/20 to-indigo-500/5 text-indigo-500 dark:text-indigo-400",
      href: "/projects",
    },
  ];

  const isLoading = projectsLoading || usersLoading;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome header */}
      <motion.div variants={itemAnim} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Welcome back, <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">{user?.name?.split(" ").pop()}</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            Here is a quick overview of your NexusAI workspace
          </p>
        </div>
      </motion.div>

      {/* Stats Cards grid (Bento style) */}
      <motion.div variants={itemAnim} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              className="bg-card/80 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-white/5 p-6 shadow-xl shadow-black/5 dark:shadow-black/20 group relative overflow-hidden h-full flex flex-col justify-between"
            >
              {/* Glow background */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${s.color} blur-[50px] opacity-50 group-hover:opacity-100 transition-opacity duration-500 -z-10`} />

              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${s.color} ring-1 ring-white/10`}>
                  <s.icon size={22} className="opacity-80" />
                </div>
                <ArrowUpRight size={20} className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
              </div>
              
              <div className="mt-8">
                <p className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                  {isLoading ? <Loader2 className="animate-spin text-zinc-300" size={28} /> : s.value}
                </p>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-1">{s.label}</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </motion.div>

      {/* Recent Projects Bento Box */}
      <motion.div variants={itemAnim} className="bg-card/80 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-white/5 shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden relative">
        <div className="absolute top-[-50%] left-[-10%] w-[50%] h-[100%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
        
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-200/60 dark:border-white/5">
          <div>
            <h2 className="font-bold text-zinc-900 dark:text-white text-xl">Recent Projects</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Quick access to recently created or edited projects</p>
          </div>
          <Link
            href="/projects"
            className="text-sm font-bold bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 px-4 py-2 rounded-xl text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-all active:scale-95"
          >
            View all
          </Link>
        </div>
        
        <div className="divide-y divide-zinc-100 dark:divide-white/5 relative z-10">
          {isLoading ? (
            <div className="py-16 flex justify-center items-center gap-3">
              <Loader2 className="animate-spin text-indigo-500" size={24} />
              <span className="text-zinc-500 font-medium">Loading workspace...</span>
            </div>
          ) : projects?.length === 0 ? (
            <div className="text-center py-16">
              <FolderKanban size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-medium">No projects found yet. Time to start building!</p>
            </div>
          ) : (
            projects?.slice(0, 5).map((p: any) => (
              <Link
                key={p.id}
                href={`/browse/${p.id}`}
                className="flex items-center justify-between px-8 py-5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group"
              >
                <div>
                  <p className="font-bold text-lg text-zinc-900 dark:text-white group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                      <FolderKanban size={14} className="text-indigo-500" /> {p._count?.tasks || 0} tasks
                    </span>
                    <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                      <Users size={14} className="text-emerald-500" /> {p.members?.length || 0} members
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-lg border",
                      p.status === "ACTIVE" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      p.status === "COMPLETED" && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                      p.status === "ON_HOLD" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      p.status === "PLANNING" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                      !["ACTIVE", "COMPLETED", "ON_HOLD", "PLANNING"].includes(p.status) && "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                    )}
                  >
                    {p.status}
                  </span>
                  <span className="text-sm font-semibold text-zinc-400 hidden sm:block">
                    {formatDate(p.createdAt)}
                  </span>
                  <ArrowUpRight size={18} className="text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-500 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
