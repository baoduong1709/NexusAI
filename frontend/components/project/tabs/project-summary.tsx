"use client";

import { useMemo, CSSProperties } from "react";
import Link from "next/link";
import {
  ListChecks,
  CheckCircle,
  Loader2,
  Users,
  Clock,
  Timer,
  TrendingUp,
  BarChart2,
  Zap,
} from "lucide-react";
import {
  cn,
  formatDate,
  PRIORITY_COLORS,
  TaskWorkflow,
} from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectSummaryTabProps {
  filteredTasks: any[];
  workflowStatuses: string[];
  projectWorkflow: TaskWorkflow;
  project: any;
  documents: any[];
  totalEstimateHours: number;
  totalLoggedHours: number;
  getTaskStatusInlineStyle: (
    status: string,
    workflow: TaskWorkflow,
  ) => CSSProperties;
  openEditTask: (task: any) => void;
  formatDuration: (hours: any) => string;
}

// ─── Status color mapping for CSS charts ────────────────────────────────────────

const STATUS_CHART_COLORS: Record<string, string> = {
  TODO: "#71717a",
  IN_PROGRESS: "#3b82f6",
  REVIEW: "#f59e0b",
  DONE: "#10b981",
  BLOCKED: "#f43f5e",
};

const STATUS_BG_CLASSES: Record<string, string> = {
  TODO: "bg-zinc-400",
  IN_PROGRESS: "bg-blue-500",
  REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
  BLOCKED: "bg-rose-500",
};

const STATUS_DOT_CLASSES: Record<string, string> = {
  TODO: "bg-zinc-400",
  IN_PROGRESS: "bg-blue-500",
  REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
  BLOCKED: "bg-rose-500",
};

const PRIORITY_BAR_COLORS: Record<string, string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-emerald-500",
};

const PRIORITY_DOT_COLORS: Record<string, string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-emerald-500",
};

// ─── Helper: get a fallback color for dynamic statuses ──────────────────────────

function getStatusColor(status: string, index: number): string {
  if (STATUS_CHART_COLORS[status]) return STATUS_CHART_COLORS[status];
  const fallback = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
  return fallback[index % fallback.length];
}

function getStatusBgClass(status: string): string {
  return STATUS_BG_CLASSES[status] || "bg-indigo-500";
}

function getStatusDotClass(status: string): string {
  return STATUS_DOT_CLASSES[status] || "bg-indigo-500";
}

// ─── Card wrapper ───────────────────────────────────────────────────────────────

const cardClass =
  "bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200/80 dark:border-white/5 p-5";
const headerClass = "text-sm font-semibold text-zinc-700 dark:text-zinc-300";

// ─── Component ──────────────────────────────────────────────────────────────────

export function ProjectSummaryTab({
  filteredTasks,
  workflowStatuses,
  projectWorkflow,
  project,
  documents,
  totalEstimateHours,
  totalLoggedHours,
  getTaskStatusInlineStyle,
  openEditTask,
  formatDuration,
}: ProjectSummaryTabProps) {
  // ── Computed data ───────────────────────────────────────────────────────────

  const lastStatus = workflowStatuses[workflowStatuses.length - 1];

  const completedCount = useMemo(
    () => filteredTasks.filter((t) => t.status === lastStatus).length,
    [filteredTasks, lastStatus],
  );

  const inProgressCount = useMemo(
    () =>
      filteredTasks.filter(
        (t) =>
          t.status !== lastStatus &&
          t.status !== workflowStatuses[0],
      ).length,
    [filteredTasks, lastStatus, workflowStatuses],
  );

  const completionPct = filteredTasks.length
    ? Math.round((completedCount / filteredTasks.length) * 100)
    : 0;

  // Status distribution
  const statusDistribution = useMemo(() => {
    return workflowStatuses.map((status, idx) => {
      const count = filteredTasks.filter((t) => t.status === status).length;
      return { status, count, color: getStatusColor(status, idx) };
    });
  }, [filteredTasks, workflowStatuses]);

  // Priority distribution
  const priorityDistribution = useMemo(() => {
    const priorities = ["HIGH", "MEDIUM", "LOW"];
    return priorities.map((p) => ({
      priority: p,
      count: filteredTasks.filter((t) => t.priority === p).length,
    }));
  }, [filteredTasks]);

  // Team workload
  const teamWorkload = useMemo(() => {
    const map = new Map<
      string,
      { name: string; tasks: number; logged: number; estimate: number }
    >();
    filteredTasks.forEach((t) => {
      const name = t.assignee?.name || "Chưa gán";
      const key = t.assignee?.email || "__unassigned__";
      if (!map.has(key)) {
        map.set(key, { name, tasks: 0, logged: 0, estimate: 0 });
      }
      const entry = map.get(key)!;
      entry.tasks += 1;
      entry.logged += Number(t.loggedHours) || 0;
      entry.estimate += Number(t.estimateHours) || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.tasks - a.tasks);
  }, [filteredTasks]);

  const maxTeamTasks = Math.max(...teamWorkload.map((m) => m.tasks), 1);

  // Sprint progress
  const sprintProgress = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; completed: number }
    >();
    filteredTasks.forEach((t) => {
      const sprint = t.sprint || "Backlog";
      if (!map.has(sprint)) {
        map.set(sprint, { name: sprint, total: 0, completed: 0 });
      }
      const entry = map.get(sprint)!;
      entry.total += 1;
      if (t.status === lastStatus) entry.completed += 1;
    });
    return Array.from(map.values());
  }, [filteredTasks, lastStatus]);

  // Recent tasks (sorted by createdAt desc)
  const recentTasks = useMemo(() => {
    return [...filteredTasks]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 8);
  }, [filteredTasks]);

  // Donut chart conic-gradient
  const donutGradient = useMemo(() => {
    const total = filteredTasks.length || 1;
    let acc = 0;
    const stops: string[] = [];
    statusDistribution.forEach(({ color, count }) => {
      const start = acc;
      const end = acc + (count / total) * 100;
      stops.push(`${color} ${start}% ${end}%`);
      acc = end;
    });
    // Fill remaining (should be 0 normally, but just in case)
    if (acc < 100) {
      stops.push(`#27272a ${acc}% 100%`);
    }
    return `conic-gradient(${stops.join(", ")})`;
  }, [statusDistribution, filteredTasks.length]);

  // ── KPI data ────────────────────────────────────────────────────────────────

  const kpis = [
    {
      label: "Tổng Tasks",
      value: filteredTasks.length,
      icon: ListChecks,
      accent: "text-blue-500 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-500/10",
    },
    {
      label: "Hoàn thành",
      value: completedCount,
      icon: CheckCircle,
      accent: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "Đang thực hiện",
      value: inProgressCount,
      icon: Loader2,
      accent: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      label: "Thành viên",
      value: project.members?.length || 0,
      icon: Users,
      accent: "text-violet-500 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-500/10",
    },
    {
      label: "Ước lượng",
      value: formatDuration(totalEstimateHours),
      icon: Clock,
      accent: "text-cyan-500 dark:text-cyan-400",
      bg: "bg-cyan-50 dark:bg-cyan-500/10",
    },
    {
      label: "Đã ghi nhận",
      value: formatDuration(totalLoggedHours),
      icon: Timer,
      accent: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-500/10",
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cardClass}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  kpi.bg,
                )}
              >
                <kpi.icon className={cn("w-4.5 h-4.5", kpi.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {kpi.label}
                </p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">
                  {kpi.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row 1: Status + Priority ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Donut: Task status distribution */}
        <div className={cardClass}>
          <h3 className={cn(headerClass, "mb-4 flex items-center gap-2")}>
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            Phân bổ trạng thái
          </h3>
          <div className="flex flex-col items-center gap-5">
            {/* Donut chart */}
            <div className="relative w-44 h-44">
              <div
                className="w-full h-full rounded-full transition-all"
                style={{
                  background: filteredTasks.length > 0 ? donutGradient : "#e4e4e7",
                }}
              />
              {/* Inner circle (creates the donut hole) */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-white dark:bg-zinc-900/95 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {completionPct}%
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    hoàn thành
                  </span>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full">
              {statusDistribution.map(({ status, count, color }) => (
                <div
                  key={status}
                  className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate flex-1">{status}</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority distribution (horizontal bars) */}
        <div className={cardClass}>
          <h3 className={cn(headerClass, "mb-4 flex items-center gap-2")}>
            <Zap className="w-4 h-4 text-zinc-400" />
            Phân bổ độ ưu tiên
          </h3>
          <div className="space-y-4 mt-2">
            {priorityDistribution.map(({ priority, count }) => {
              const pct = filteredTasks.length
                ? Math.round((count / filteredTasks.length) * 100)
                : 0;
              const labels: Record<string, string> = {
                HIGH: "Cao",
                MEDIUM: "Trung bình",
                LOW: "Thấp",
              };
              return (
                <div key={priority} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2.5 h-2.5 rounded-full flex-shrink-0",
                          PRIORITY_DOT_COLORS[priority],
                        )}
                      />
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                        {labels[priority] || priority}
                      </span>
                    </div>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        PRIORITY_BAR_COLORS[priority] || "bg-zinc-400",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary stats below priority bars */}
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-white/5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {priorityDistribution.map(({ priority, count }) => {
                const labels: Record<string, string> = {
                  HIGH: "Cao",
                  MEDIUM: "TB",
                  LOW: "Thấp",
                };
                return (
                  <div key={priority}>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {count}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {labels[priority] || priority}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row 2: Team Workload + Sprint Progress ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Team workload */}
        <div className={cardClass}>
          <h3 className={cn(headerClass, "mb-4 flex items-center gap-2")}>
            <Users className="w-4 h-4 text-zinc-400" />
            Khối lượng công việc
          </h3>
          {teamWorkload.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-6">
              Chưa có dữ liệu
            </p>
          ) : (
            <div className="space-y-3">
              {teamWorkload.slice(0, 8).map((member) => {
                const taskPct = Math.round((member.tasks / maxTeamTasks) * 100);
                return (
                  <div key={member.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[140px]">
                        {member.name}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                        {member.tasks} tasks · {formatDuration(member.logged)} / {formatDuration(member.estimate)}
                      </span>
                    </div>
                    {/* Task count bar */}
                    <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
                        style={{ width: `${taskPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sprint progress */}
        <div className={cardClass}>
          <h3 className={cn(headerClass, "mb-4 flex items-center gap-2")}>
            <BarChart2 className="w-4 h-4 text-zinc-400" />
            Tiến độ Sprint
          </h3>
          {sprintProgress.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-6">
              Chưa có sprint nào
            </p>
          ) : (
            <div className="space-y-3">
              {sprintProgress.map((sp) => {
                const pct = sp.total
                  ? Math.round((sp.completed / sp.total) * 100)
                  : 0;
                return (
                  <div key={sp.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[160px]">
                        {sp.name}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                        {sp.completed}/{sp.total} · {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pct === 100
                            ? "bg-emerald-500 dark:bg-emerald-400"
                            : pct >= 50
                              ? "bg-blue-500 dark:bg-blue-400"
                              : "bg-amber-500 dark:bg-amber-400",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Tasks ──────────────────────────────────────────────────── */}
      <div className={cardClass}>
        <h3 className={cn(headerClass, "mb-3")}>Tasks gần đây</h3>
        {filteredTasks.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
            Chưa có task nào
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {recentTasks.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5 rounded-lg px-2 -mx-2 transition-all"
                onClick={() => openEditTask(t)}
              >
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0"
                  style={getTaskStatusInlineStyle(t.status, projectWorkflow)}
                >
                  {t.status}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">
                    {t.title}
                  </p>
                  <Link
                    href={`/browse/${t.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] font-semibold text-zinc-400 hover:text-indigo-500 hover:underline transition-colors block w-fit"
                  >
                    {t.id}
                  </Link>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                    PRIORITY_COLORS[
                      t.priority as keyof typeof PRIORITY_COLORS
                    ],
                  )}
                >
                  {t.priority}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0 hidden sm:inline">
                  {formatDuration(t.loggedHours)} /{" "}
                  {formatDuration(t.estimateHours)}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                  {t.assignee?.name || "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
