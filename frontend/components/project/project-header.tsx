"use client";

import { useRouter } from "next/navigation";
import {
  Users,
  FileText,
  CalendarDays,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface ProjectHeaderProps {
  project: {
    id: number;
    name: string;
    description?: string;
    startDate?: string;
    members?: Array<{
      userId: number;
      role: string;
      user: {
        name: string;
        email: string;
      };
    }>;
  };
  totalTasks: number;
  doneTasks: number;
  totalDocs: number;
  canDelete: boolean;
  canCreateTask: boolean;
  onDeleteProject: () => void;
  onAddTask: () => void;
}

export function ProjectHeader({
  project,
  totalTasks,
  doneTasks,
  totalDocs,
  canDelete,
  canCreateTask,
  onDeleteProject,
  onAddTask,
}: ProjectHeaderProps) {
  const router = useRouter();

  // Calculate project completion progress
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="bg-zinc-950/80 border border-white/5 rounded-xl px-4 py-2 flex items-center justify-between gap-4 h-14 backdrop-blur-xl relative overflow-hidden select-none">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/[0.02] blur-[60px] pointer-events-none rounded-full" />
      
      {/* Left: Info & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push("/projects")}
          className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all shrink-0"
          title="Back to projects"
        >
          <ChevronLeft size={14} />
        </button>
        
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-white truncate max-w-[160px] md:max-w-[240px]">
            {project.name}
          </h1>
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
            Active
          </span>
        </div>
      </div>

      {/* Center: Compact Inline Metrics */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] font-medium text-zinc-400 shrink-0">
        <span className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] border border-white/5 rounded-lg">
          <Users size={12} className="text-indigo-400" />
          <span>{project.members?.length || 0} Members</span>
        </span>
        <span className="text-zinc-700">|</span>
        <span className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] border border-white/5 rounded-lg">
          <CheckCircle2 size={12} className="text-blue-400" />
          <span>{doneTasks}/{totalTasks} Tasks</span>
        </span>
        <span className="text-zinc-700">|</span>
        <span className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] border border-white/5 rounded-lg">
          <FileText size={12} className="text-amber-400" />
          <span>{totalDocs} Docs</span>
        </span>
        {project.startDate && (
          <>
            <span className="text-zinc-700">|</span>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] border border-white/5 rounded-lg">
              <CalendarDays size={12} className="text-emerald-400" />
              <span>{formatDate(project.startDate)}</span>
            </span>
          </>
        )}
      </div>

      {/* Right: Progress & Action Buttons */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Compact Progress */}
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <div className="w-12 bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-zinc-400 font-bold">{progressPercent}%</span>
        </div>

        <div className="flex items-center gap-1.5">
          {canCreateTask && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-md active:scale-95 transition-all shrink-0 h-8"
            >
              <Plus size={13} /> Task
            </button>
          )}

          {canDelete && (
            <button
              onClick={onDeleteProject}
              className="p-2 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded-lg transition-all shrink-0 h-8 w-8 flex items-center justify-center"
              title="Delete Project"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
