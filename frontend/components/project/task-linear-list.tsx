"use client";

import { useState } from "react";
import {
  Pencil,
  Trash2,
  Calendar,
  Clock,
  User,
  Sparkles,
  ChevronDown,
  Plus,
  GitBranch,
} from "lucide-react";
import { cn, stripHtmlTags, formatDate } from "@/lib/utils";

// Format estimates/logged time
const formatDuration = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined || hours === 0) return "-";
  return `${hours}h`;
};

// Priority Badge mapping
const getPriorityBadge = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case "HIGH":
      return {
        label: "High",
        class: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      };
    case "MEDIUM":
      return {
        label: "Med",
        class: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      };
    case "LOW":
      return {
        label: "Low",
        class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      };
    default:
      return {
        label: priority || "None",
        class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      };
  }
};

// Custom Status Pill component mimicking Linear
interface StatusPillProps {
  status: string;
  allowedStatuses: string[];
  onChangeStatus?: (nextStatus: string) => void;
  canUpdate: boolean;
}

function StatusPill({ status, allowedStatuses, onChangeStatus, canUpdate }: StatusPillProps) {
  const normalizedStatus = status?.toUpperCase() || "TODO";
  
  let pillStyle = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  if (normalizedStatus.includes("PROGRESS") || normalizedStatus === "IN_PROGRESS") {
    pillStyle = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  } else if (normalizedStatus.includes("REVIEW") || normalizedStatus === "REVIEW") {
    pillStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  } else if (normalizedStatus.includes("DONE") || normalizedStatus === "DONE") {
    pillStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  } else if (normalizedStatus.includes("BLOCKED") || normalizedStatus === "BLOCKED") {
    pillStyle = "bg-rose-500/10 text-rose-400 border-rose-500/20";
  }

  if (!canUpdate) {
    return (
      <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border tracking-wide uppercase", pillStyle)}>
        {status}
      </span>
    );
  }

  return (
    <div className={cn("relative inline-flex items-center rounded border px-1.5 py-0.5 transition-all text-[9px] font-semibold tracking-wide uppercase select-none hover:brightness-110", pillStyle)}>
      <select
        value={status}
        onChange={(e) => onChangeStatus && onChangeStatus(e.target.value)}
        className="bg-transparent border-0 outline-none text-[9px] font-semibold tracking-wide uppercase cursor-pointer appearance-none pr-3"
      >
        {allowedStatuses.map((s) => (
          <option key={s} value={s} className="bg-zinc-950 text-zinc-200">
            {s}
          </option>
        ))}
      </select>
      <ChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
    </div>
  );
}

interface TaskLinearListProps {
  tasks: any[];
  projectWorkflow: any;
  onEditTask: (task: any) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, nextStatus: string) => void;
  canUpdateTask: boolean;
  canDeleteTask: boolean;
  onAiAssist?: (task: any) => void;
  getAllowedTransitionStatuses: (workflow: any, currentStatus: string) => string[];
  
  // Sprint and Action Integrations (Iteration 2)
  allSprints: string[];
  sprintFilter: string;
  onSprintFilterChange: (sprint: string) => void;
  onManageSprints: () => void;
  canCreateTask: boolean;
  onAddTask: () => void;
}

export function TaskLinearList({
  tasks,
  projectWorkflow,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  canUpdateTask,
  canDeleteTask,
  onAiAssist,
  getAllowedTransitionStatuses,
  allSprints,
  sprintFilter,
  onSprintFilterChange,
  onManageSprints,
  canCreateTask,
  onAddTask,
}: TaskLinearListProps) {
  
  return (
    <div className="bg-zinc-950/40 border border-white/5 rounded-xl overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col min-h-0 select-none">
      
      {/* Dynamic Integrated Table Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-zinc-900/20 shrink-0 h-9">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-200">
            Tasks ({tasks.length})
          </span>
          <span className="text-zinc-700 text-xs">|</span>
          
          {/* Integrated Sprint Selector Dropdown */}
          <div className="relative flex items-center gap-1.5">
            <GitBranch size={11} className="text-zinc-400" />
            <select
              value={sprintFilter}
              onChange={(e) => onSprintFilterChange(e.target.value)}
              className="bg-transparent border-0 outline-none text-[11px] font-semibold text-zinc-400 hover:text-white cursor-pointer appearance-none pr-4"
            >
              <option value="" className="bg-zinc-950 text-zinc-400">All Sprints</option>
              {allSprints.map((sprint) => (
                <option key={sprint} value={sprint} className="bg-zinc-950 text-zinc-200">
                  {sprint}
                </option>
              ))}
            </select>
            <ChevronDown size={9} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>

          <button
            onClick={onManageSprints}
            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 ml-1"
          >
            Manage Sprints
          </button>
        </div>

        {/* Quick Add Task button integrated into header */}
        {canCreateTask && (
          <button
            onClick={onAddTask}
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white px-2 py-0.5 rounded text-[10px] font-medium transition-all active:scale-95 border border-white/5 h-6"
          >
            <Plus size={11} /> Add Task
          </button>
        )}
      </div>

      {/* High-density task list view */}
      <div className="overflow-x-auto flex-1 min-h-0 scrollbar-thin">
        <table className="w-full text-left border-collapse table-fixed">
          {/* Sticky Table Header */}
          <thead className="sticky top-0 bg-zinc-950 z-20 shadow-sm border-b border-white/5">
            <tr className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider select-none bg-zinc-900/40">
              <th className="pl-4 pr-2 py-1.5 w-20">ID</th>
              <th className="px-3 py-1.5 w-[35%]">Title & Description</th>
              <th className="px-3 py-1.5 w-[12%]">Assignee</th>
              <th className="px-3 py-1.5 w-[10%]">Priority</th>
              <th className="px-3 py-1.5 w-[12%]">Epic</th>
              <th className="px-3 py-1.5 w-[10%] font-mono">Est/Log</th>
              <th className="px-3 py-1.5 w-[11%]">Due Date</th>
              <th className="px-3 py-1.5 w-[12%]">Status</th>
              <th className="pr-4 pl-1 py-1.5 w-20 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-white/[0.03]">
            {tasks.map((task) => {
              const priorityInfo = getPriorityBadge(task.priority);
              const initials = task.assignee?.name
                ? task.assignee.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase()
                : "";

              const cleanDesc = stripHtmlTags(task.description || "");
              const transitions = getAllowedTransitionStatuses(projectWorkflow, task.status);

              return (
                <tr
                  key={task.id}
                  className="group hover:bg-white/[0.02] active:bg-white/[0.01] transition-all cursor-pointer duration-100 border-b border-white/[0.01]"
                  onClick={() => onEditTask(task)}
                >
                  {/* Task ID */}
                  <td className="pl-4 pr-2 py-1 font-mono text-[10px] font-bold text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    {task.id}
                  </td>

                  {/* Title & Short Description */}
                  <td className="px-3 py-1 truncate">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
                        {task.title}
                      </p>
                      {task.isAiGenerated && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.2 rounded text-[8px] font-bold tracking-wide uppercase">
                          <Sparkles size={7} /> AI
                        </span>
                      )}
                      {cleanDesc && (
                        <span className="text-[10px] text-zinc-500 font-normal truncate opacity-60 ml-2">
                          {cleanDesc}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5" title={task.assignee.name}>
                        <div className="w-4.5 h-4.5 rounded-full bg-indigo-600/80 border border-indigo-500/20 flex items-center justify-center text-[8px] font-bold text-white shadow-sm shrink-0">
                          {initials}
                        </div>
                        <span className="text-[10px] text-zinc-300 truncate">
                          {task.assignee.name.split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] italic text-zinc-600">Unassigned</span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    <span className={cn("inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-semibold border tracking-wide uppercase", priorityInfo.class)}>
                      {priorityInfo.label}
                    </span>
                  </td>

                  {/* Epic */}
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    {task.epic ? (
                      <span className="inline-flex px-1.5 py-0.2 rounded text-[8px] font-semibold bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 truncate max-w-full">
                        {task.epic}
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-[10px]">-</span>
                    )}
                  </td>

                  {/* Est / Logged */}
                  <td className="px-3 py-1 font-mono text-[9px] text-zinc-500" onClick={(e) => e.stopPropagation()}>
                    <span title="Est">{formatDuration(task.estimateHours)}</span>
                    <span className="text-zinc-700 mx-0.5">/</span>
                    <span className="text-indigo-400 font-bold" title="Logged">{formatDuration(task.loggedHours)}</span>
                  </td>

                  {/* Due Date */}
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    {task.dueDate ? (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {formatDate(task.dueDate)}
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-[10px]">-</span>
                    )}
                  </td>

                  {/* Status Pill Dropdown */}
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    <StatusPill
                      status={task.status}
                      allowedStatuses={transitions}
                      onChangeStatus={(next) => onStatusChange(task.id, next)}
                      canUpdate={canUpdateTask}
                    />
                  </td>

                  {/* Quick Actions */}
                  <td className="pr-4 pl-1 py-1" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {onAiAssist && (
                        <button
                          onClick={() => onAiAssist(task)}
                          className="p-1 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded transition-all"
                          title="Ask AI Assistant"
                        >
                          <Sparkles size={10} />
                        </button>
                      )}
                      {canUpdateTask && (
                        <button
                          onClick={() => onEditTask(task)}
                          className="p-1 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-all"
                          title="Edit Task"
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                      {canDeleteTask && (
                        <button
                          onClick={() =>
                            confirm("Delete this task?") && onDeleteTask(task.id)
                          }
                          className="p-1 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded transition-all"
                          title="Delete Task"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
