"use client";

import { useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/providers/confirm-provider";
import { CustomSelect } from "@/components/ui/custom-select";
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
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide uppercase", pillStyle)}>
        {status}
      </span>
    );
  }

  const statusOptions = allowedStatuses.map((s) => ({ value: s, label: s }));

  return (
    <CustomSelect
      value={status}
      onChange={(val) => onChangeStatus && onChangeStatus(val)}
      options={statusOptions}
      placeholder={status}
      size="sm"
      buttonClassName={cn("bg-transparent border-0 text-[10px] font-semibold tracking-wide uppercase cursor-pointer hover:bg-transparent dark:hover:bg-transparent p-0 h-auto", pillStyle.replace("bg-", "text-").replace("border-", ""))}
      className={cn("rounded px-2 py-0.5 border select-none transition-all hover:brightness-110", pillStyle)}
    />
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
  const confirm = useConfirm();

  const sprintOptions = [
    { value: "", label: "All Sprints" },
    ...allSprints.map((sprint) => ({ value: sprint, label: sprint }))
  ];
  
  return (
    <div className="bg-white/80 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-white/5 rounded-xl overflow-hidden shadow-lg dark:shadow-2xl backdrop-blur-xl flex flex-col min-h-0 select-none">
      
      {/* Dynamic Integrated Table Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200/60 dark:border-white/5 bg-zinc-50/80 dark:bg-zinc-900/20 shrink-0 h-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
            Tasks ({tasks.length})
          </span>
          <span className="text-zinc-300 dark:text-zinc-700 text-xs">|</span>
          
          {/* Integrated Sprint Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <GitBranch size={11} className="text-zinc-400 shrink-0" />
            <CustomSelect
              value={sprintFilter}
              onChange={onSprintFilterChange}
              options={sprintOptions}
              placeholder="All Sprints"
              buttonClassName="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900/40 border-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white font-semibold pr-2.5 h-7 rounded px-1.5 text-xs"
            />
          </div>

          <button
            onClick={onManageSprints}
            className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 ml-1"
          >
            Manage Sprints
          </button>
        </div>

        {/* Quick Add Task button integrated into header */}
        {canCreateTask && (
          <button
            onClick={onAddTask}
            className="flex items-center gap-1 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1 rounded text-xs font-medium transition-all active:scale-95 border border-zinc-200 dark:border-white/5 h-7"
          >
            <Plus size={12} /> Add Task
          </button>
        )}
      </div>

      {/* High-density task list view */}
      <div className="overflow-x-auto flex-1 min-h-0 scrollbar-thin">
        <table className="w-full text-left border-collapse table-fixed">
          {/* Sticky Table Header */}
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 z-20 shadow-sm border-b border-zinc-200/60 dark:border-white/5">
            <tr className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider select-none bg-zinc-100/60 dark:bg-zinc-900/40">
              <th className="pl-4 pr-2 py-2.5 w-20">ID</th>
              <th className="px-3 py-2.5 w-[35%]">Title</th>
              <th className="px-3 py-2.5 w-[12%]">Assignee</th>
              <th className="px-3 py-2.5 w-[10%]">Priority</th>
              <th className="px-3 py-2.5 w-[12%]">Epic</th>
              <th className="px-3 py-2.5 w-[10%] font-mono">Est/Log</th>
              <th className="px-3 py-2.5 w-[11%]">Due Date</th>
              <th className="px-3 py-2.5 w-[12%]">Status</th>
              <th className="pr-4 pl-1 py-2.5 w-20 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.03]">
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
                  className="group hover:bg-zinc-50 dark:hover:bg-white/[0.02] active:bg-zinc-100 dark:active:bg-white/[0.01] transition-all cursor-pointer duration-100"
                  onClick={() => onEditTask(task)}
                >
                  {/* Task ID */}
                  <td className="pl-4 pr-2 py-2.5 font-mono text-xs font-bold text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                    <Link
                      href={`/browse/${task.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-indigo-500 hover:underline transition-colors block"
                    >
                      {task.id}
                    </Link>
                  </td>

                  {/* Title & Short Description */}
                  <td className="px-3 py-2.5 truncate">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors truncate">
                        {task.title}
                      </p>
                      {task.isAiGenerated && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase">
                          <Sparkles size={8} /> AI
                        </span>
                      )}

                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="px-3 py-2.5">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5" title={task.assignee.name}>
                        <div className="w-5.5 h-5.5 rounded-full bg-indigo-600/80 border border-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-white shadow-sm shrink-0">
                          {initials}
                        </div>
                        <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                          {task.assignee.name.split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs italic text-zinc-400 dark:text-zinc-600">Unassigned</span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide uppercase", priorityInfo.class)}>
                      {priorityInfo.label}
                    </span>
                  </td>

                  {/* Epic */}
                  <td className="px-3 py-2.5">
                    {task.epic ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 truncate max-w-full">
                        {task.epic}
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700 text-xs">-</span>
                    )}
                  </td>

                  {/* Est / Logged */}
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                    <span title="Est">{formatDuration(task.estimateHours)}</span>
                    <span className="text-zinc-300 dark:text-zinc-700 mx-0.5">/</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold" title="Logged">{formatDuration(task.loggedHours)}</span>
                  </td>

                  {/* Due Date */}
                  <td className="px-3 py-2.5">
                    {task.dueDate ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        {formatDate(task.dueDate)}
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700 text-xs">-</span>
                    )}
                  </td>

                  {/* Status Pill Dropdown */}
                  <td className="px-3 py-2.5 relative focus-within:z-40" onClick={(e) => e.stopPropagation()}>
                    <StatusPill
                      status={task.status}
                      allowedStatuses={transitions}
                      onChangeStatus={(next) => onStatusChange(task.id, next)}
                      canUpdate={canUpdateTask}
                    />
                  </td>

                  {/* Quick Actions */}
                  <td className="pr-4 pl-1 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {onAiAssist && (
                        <button
                          onClick={() => onAiAssist(task)}
                          className="p-1.5 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded transition-all"
                          title="Ask AI Assistant"
                        >
                          <Sparkles size={12} />
                        </button>
                      )}
                      {canUpdateTask && (
                        <button
                          onClick={() => onEditTask(task)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded transition-all"
                          title="Edit Task"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {canDeleteTask && (
                        <button
                        onClick={async () => {
                          const isConfirmed = await confirm({
                            title: "Xóa công việc",
                            message: `Bạn có chắc chắn muốn xóa công việc "${task.title || 'này'}" không? Hành động này không thể hoàn tác.`,
                            confirmText: "Xóa",
                            cancelText: "Hủy",
                            variant: "destructive",
                          });
                          if (isConfirmed) {
                            onDeleteTask(task.id);
                          }
                        }}
                        className="p-1.5 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded transition-all"
                        title="Delete Task"
                        >
                          <Trash2 size={12} />
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
