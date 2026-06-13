"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Link from "next/link";
import { 
  ChevronDown, 
  ArrowLeft, 
  Loader2, 
  Terminal, 
  Copy, 
  Trash2, 
  Calendar,
  AlertCircle,
  Link2,
  Unlink,
  Plus
} from "lucide-react";
import { motion } from "framer-motion";

import { tasksApi, projectsApi, aiApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DescriptionEditor, sanitizeRichTextHtml } from "@/components/project/description-editor";
import { CommentEditor } from "@/components/project/comment-editor";
import { CustomSelect } from "@/components/ui/custom-select";
import { useConfirm } from "@/components/providers/confirm-provider";
import { 
  PRIORITY_COLORS, 
  getTaskStatusInlineStyle, 
  stripHtmlTags, 
  formatDuration, 
  toHours, 
  parseDurationInput,
  formatDateTime,
  normalizeTaskWorkflow,
  getAllowedTransitionStatuses
} from "@/lib/utils";

type ActivityTab = "all" | "comments" | "history" | "worklog";

export function TaskDetailView() {
  const router = useRouter();
  const { id: taskId } = useParams() as { id: string };
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();

  // Component states
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [descriptionAiMessages, setDescriptionAiMessages] = useState<any[]>([]);
  const [generatedTaskPrompt, setGeneratedTaskPrompt] = useState("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [activityTab, setActivityTab] = useState<ActivityTab>("comments");
  const [commentDraft, setCommentDraft] = useState("");
  const [workLogDraft, setWorkLogDraft] = useState("");
  const [workLogNote, setWorkLogNote] = useState("");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);

  // 1. Fetch Task Details (via our new root-level lookup endpoint)
  const taskQuery = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => tasksApi.getOneWithoutProject(taskId).then((r) => r.data),
    enabled: !!taskId,
  });

  const task = taskQuery.data;
  const projectId = task?.projectId;

  // 2. Fetch Project Details (for assignee select & workflow configs)
  const projectQuery = useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: () => projectsApi.getOne(projectId).then((r) => r.data),
    enabled: !!projectId,
  });

  const project = projectQuery.data;

  // 3. Fetch Task Activities
  const activitiesQuery = useQuery({
    queryKey: ["task-activities", projectId, taskId],
    queryFn: () => tasksApi.getActivities(projectId, taskId).then((r) => r.data),
    enabled: !!projectId && !!taskId,
  });

  const activities = activitiesQuery.data || [];

  // Form setup
  const { register, setValue, watch, reset, getValues } = useForm({
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      status: "",
      assigneeId: "",
      dueDate: "",
      epic: "",
      labels: [] as string[],
      sprint: "",
      estimateInput: "",
      loggedInput: "",
    },
  });

  // Watch inputs for rendering
  const watchedEstimateInput = watch("estimateInput");
  const watchedLoggedInput = watch("loggedInput");

  // Reset form when task details are loaded
  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        assigneeId: task.assigneeId ? task.assigneeId.toString() : "",
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
        epic: task.epic || "",
        labels: task.labels || [],
        sprint: task.sprint || "",
        estimateInput: toHours(task.estimateHours) ? formatDuration(task.estimateHours) : "",
        loggedInput: toHours(task.loggedHours) ? formatDuration(task.loggedHours) : "",
      });
      setDescriptionHtml(task.description || "");
      setGeneratedTaskPrompt(task.agentPrompt || "");
    }
  }, [task, reset]);

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: ({ data }: { data: any }) =>
      tasksApi.update(projectId, taskId, data),
    onSuccess: (res) => {
      // Invalidate both local cache and parent project tasks
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-activities", projectId, taskId] });
      toast.success("Changes saved successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to save changes");
    },
  });

  const improveDescriptionMutation = useMutation({
    mutationFn: (payload: { title?: string; description: string }) =>
      aiApi.improveDescription(projectId, payload).then((r) => r.data),
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to improve description"),
  });

  const assistDescriptionMutation = useMutation({
    mutationFn: (payload: { title?: string; description: string; instruction: string }) =>
      aiApi.assistDescription(projectId, payload).then((r) => r.data),
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to apply AI instruction"),
  });

  const addTaskCommentMutation = useMutation({
    mutationFn: (body: string) =>
      tasksApi.addComment(projectId, taskId, body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-activities", projectId, taskId] });
      setCommentDraft("");
      toast.success("Comment added");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to add comment"),
  });

  const addTaskWorkLogMutation = useMutation({
    mutationFn: (data: { durationHours: number; note?: string }) =>
      tasksApi.addWorkLog(projectId, taskId, data).then((r) => r.data),
    onSuccess: (_activity, variables) => {
      const currentLogged = parseDurationInput(getValues("loggedInput")) || toHours(task?.loggedHours);
      const nextLogged = currentLogged + variables.durationHours;
      setValue("loggedInput", formatDuration(nextLogged));
      
      // Auto-save the updated loggedHours back to database
      autoSaveTask();

      queryClient.invalidateQueries({ queryKey: ["task-activities", projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setWorkLogDraft("");
      setWorkLogNote("");
      toast.success("Work logged successfully");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to add work log"),
  });

  const linkTaskMutation = useMutation({
    mutationFn: (targetTaskId: string) =>
      tasksApi.linkTask(projectId, taskId, targetTaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activities", projectId, taskId] });
      toast.success("Task linked successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to link task");
    },
  });

  const unlinkTaskMutation = useMutation({
    mutationFn: (targetTaskId: string) =>
      tasksApi.unlinkTask(projectId, taskId, targetTaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activities", projectId, taskId] });
      toast.success("Task unlinked successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to unlink task");
    },
  });

  const { data: projectTasksPage } = useQuery({
    queryKey: ["project-tasks-all", projectId],
    queryFn: () => tasksApi.getAll(projectId, { take: 1000 }).then((r) => r.data),
    enabled: !!projectId,
  });
  const allProjectTasks = projectTasksPage?.data ?? [];

  // Filter out current task and already linked target tasks
  const alreadyLinkedTargetIds = task?.sourceLinks?.map((link: any) => link.targetTaskId) || [];
  const availableTasksToLink = allProjectTasks.filter(
    (t: any) => t.id !== taskId && !alreadyLinkedTargetIds.includes(t.id)
  );

  const deleteTaskMutation = useMutation({
    mutationFn: () => tasksApi.delete(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      toast.success("Task deleted successfully");
      router.push(`/browse/${projectId}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete task");
    },
  });

  // Autosave triggers
  const autoSaveTask = () => {
    if (!task || updateTaskMutation.isPending) return;
    const values = getValues();
    const payload: any = {
      title: values.title,
      description: values.description,
      priority: values.priority,
      status: values.status,
      assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
      epic: values.epic || null,
      labels: values.labels,
      sprint: values.sprint || null,
      estimateHours: parseDurationInput(values.estimateInput),
      loggedHours: parseDurationInput(values.loggedInput),
    };

    updateTaskMutation.mutate({ data: payload });
  };

  // AI Description Assistants
  const handleImproveDescription = async () => {
    const current = sanitizeRichTextHtml(getValues("description") || "");
    if (!stripHtmlTags(current)) {
      toast.error("Please enter a description before using AI improve");
      return;
    }

    const title = String(getValues("title") || "").trim() || undefined;
    const result = await improveDescriptionMutation.mutateAsync({
      title,
      description: current,
    });
    const improved = sanitizeRichTextHtml(result?.description || "");
    setDescriptionHtml(improved);
    setValue("description", improved);
    setDescriptionAiMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Đã cải thiện description." },
    ]);
    autoSaveTask();
  };

  const handleAssistDescription = async (instruction: string) => {
    const current = sanitizeRichTextHtml(getValues("description") || "");
    if (!stripHtmlTags(current)) {
      toast.error("Please enter a description before asking AI");
      return;
    }

    setDescriptionAiMessages((prev) => [
      ...prev,
      { role: "user", content: instruction },
    ]);

    const title = String(getValues("title") || "").trim() || undefined;
    const result = await assistDescriptionMutation.mutateAsync({
      title,
      description: current,
      instruction,
    });
    const next = sanitizeRichTextHtml(result?.description || "");
    setDescriptionHtml(next);
    setValue("description", next);
    setDescriptionAiMessages((prev) => [
      ...prev,
      { role: "assistant", content: result?.message || "Updated." },
    ]);
    autoSaveTask();
  };

  const handleGenerateTaskPrompt = async () => {
    const currentDesc = sanitizeRichTextHtml(getValues("description") || "");
    if (!stripHtmlTags(currentDesc)) {
      toast.error("Please enter a description before generating AI prompt");
      return;
    }

    setGeneratingPrompt(true);
    setGeneratedTaskPrompt("");
    try {
      const title = String(getValues("title") || "").trim() || undefined;
      const assigneeIdVal = getValues("assigneeId");
      const assigneeId = assigneeIdVal ? Number(assigneeIdVal) : undefined;
      const labels = getValues("labels") || [];

      const result = await aiApi.generateTaskPrompt(projectId, {
        taskId,
        title,
        description: currentDesc,
        assigneeId,
        labels,
      });

      setGeneratedTaskPrompt(result.data.prompt || "");
      toast.success("Prompt generated successfully!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to generate prompt");
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // Activity functions
  const addTaskComment = () => {
    if (!commentDraft.trim()) return;
    addTaskCommentMutation.mutate(commentDraft);
  };

  const addTaskWorkLog = () => {
    const hours = parseDurationInput(workLogDraft);
    if (!hours || hours <= 0) {
      toast.error("Invalid duration format (e.g. 1h, 30m)");
      return;
    }
    addTaskWorkLogMutation.mutate({
      durationHours: hours,
      note: workLogNote.trim() || undefined,
    });
  };

  // Labels helper
  const toggleTaskLabel = (label: string) => {
    const currentLabels = getValues("labels") || [];
    const next = currentLabels.includes(label)
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];
    setValue("labels", next);
    autoSaveTask();
  };

  // Delete helper
  const handleDeleteTask = async () => {
    const isConfirmed = await confirm({
      title: "Delete Task",
      message: `Are you sure you want to delete task ${taskId}? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (isConfirmed) {
      deleteTaskMutation.mutate();
    }
  };

  // Loading States
  if (taskQuery.isLoading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={36} />
        <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Loading task details...</p>
      </div>
    );
  }

  // Error States
  if (taskQuery.isError || !task) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="p-3 bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full">
          <AlertCircle size={36} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Task Not Found</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm">
            The task with ID <span className="font-mono font-bold text-red-500">{taskId}</span> could not be loaded. It might have been deleted, or you might not have permission.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium rounded-xl hover:opacity-95 transition-opacity"
        >
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    );
  }

  // Workflow Normalization
  const projectWorkflow = normalizeTaskWorkflow(project?.taskWorkflow, project?.taskStatuses);
  const workflowStatuses = project?.taskStatuses || ["TODO", "IN_PROGRESS", "DONE"];
  const allEpics = project?.epics || [];
  const allLabels = project?.labels || [];
  const allSprints = project?.epics || []; // Assuming epics serve as fallback or project has sprints list
  const selectedTaskLabels = watch("labels") || [];

  // Filtering activities
  const filteredActivities = activities.filter((act: any) => {
    if (activityTab === "all") return true;
    if (activityTab === "comments") return act.type === "COMMENT";
    if (activityTab === "history") return act.type === "HISTORY";
    if (activityTab === "worklog") return act.type === "WORK_LOG";
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6 max-w-[1600px] mx-auto pb-12"
    >
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/5 pb-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <Link href="/projects" className="hover:text-indigo-500 transition-colors">Projects</Link>
            <span>/</span>
            {projectId && (
              <Link href={`/browse/${projectId}`} className="hover:text-indigo-500 transition-colors truncate max-w-[120px]">
                {project?.name || `Project ${projectId}`}
              </Link>
            )}
            <span>/</span>
            <span className="font-mono text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-bold">{taskId}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            Task Detail
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/browse/${projectId}`}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Project
          </Link>
          
          {hasPermission("task:delete") && (
            <button
              onClick={handleDeleteTask}
              disabled={deleteTaskMutation.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl border border-red-200/50 dark:border-red-950/40 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
        {/* Left: Task Content */}
        <div className="space-y-6">
          {/* Task Title Input */}
          <div className="w-full">
            <input
              {...register("title", {
                required: true,
                onBlur: autoSaveTask,
              })}
              className="w-full bg-transparent text-2xl font-bold text-zinc-900 dark:text-white border-b border-transparent focus:border-indigo-500/20 pb-1 outline-none placeholder:text-zinc-400 focus:ring-0 transition-colors"
              placeholder="Task title"
            />
          </div>

          {/* Description Editor */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Description
            </label>
            <input type="hidden" {...register("description")} />
            <DescriptionEditor
              projectId={projectId}
              value={descriptionHtml}
              onChange={(next) => {
                setDescriptionHtml(next);
                setValue("description", next);
              }}
              onBlur={autoSaveTask}
              onImprove={handleImproveDescription}
              onAssist={handleAssistDescription}
              aiMessages={descriptionAiMessages}
              assisting={assistDescriptionMutation.isPending}
              improving={improveDescriptionMutation.isPending}
              mentionItems={
                project?.members?.map((m: any) => ({
                  id: String(m.userId),
                  label: m.user?.name || `User ${m.userId}`,
                })) || []
              }
              disabled={updateTaskMutation.isPending}
            />
          </div>

          {/* AI Prompt Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-indigo-500" />
                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                  AI Agent Prompt
                </span>
              </div>
              <button
                type="button"
                onClick={handleGenerateTaskPrompt}
                disabled={generatingPrompt || !descriptionHtml}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {generatingPrompt ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Agent Prompt"
                )}
              </button>
            </div>
            {generatedTaskPrompt && (
              <div className="mt-4 relative">
                <textarea
                  readOnly
                  value={generatedTaskPrompt}
                  className="w-full h-40 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-4 py-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedTaskPrompt);
                    toast.success("Prompt copied to clipboard!");
                  }}
                  className="absolute right-3 top-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  title="Copy prompt"
                >
                  <Copy size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Linked Tasks Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-900/10 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-zinc-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-indigo-500 animate-pulse" />
                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                  Linked Tasks (Task liên kết)
                </span>
              </div>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
                >
                  <Plus size={13} />
                  Link Task
                </button>

                {showLinkDropdown && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowLinkDropdown(false)} />
                    <div className="absolute right-0 mt-1 w-80 z-40 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-2 shadow-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 p-2 border-b border-zinc-100 dark:border-white/5 mb-1">
                        Select a task to link
                      </div>
                      {availableTasksToLink.length === 0 ? (
                        <div className="text-xs text-zinc-400 p-2 italic">
                          No tasks available to link
                        </div>
                      ) : (
                        availableTasksToLink.map((t: any) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              linkTaskMutation.mutate(t.id);
                              setShowLinkDropdown(false);
                            }}
                            className="w-full text-left p-2 rounded-lg text-xs hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors flex flex-col gap-0.5 cursor-pointer"
                          >
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                              {t.title}
                            </span>
                            <div className="flex justify-between items-center text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                              <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                                {t.id}
                              </span>
                              <span className="font-semibold">{t.status}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* List of links */}
            <div className="space-y-4">
              {/* Tasks linked BY this task (Links to) */}
              <div>
                <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  Links to (Task mà task này liên kết đến - Người sở hữu sẽ nhận thông báo khi task này đổi trạng thái)
                </div>
                {task?.sourceLinks && task.sourceLinks.length > 0 ? (
                  <div className="space-y-2">
                    {task.sourceLinks.map((link: any) => {
                      const t = link.targetTask;
                      if (!t) return null;
                      return (
                        <div
                          key={link.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200/60 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-950/20 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold bg-zinc-100 dark:bg-white/5 text-[10px] px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                              {t.id}
                            </span>
                            <Link
                              href={`/browse/${t.id}`}
                              className="font-medium text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate hover:underline"
                            >
                              {t.title}
                            </Link>
                          </div>
                          
                          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                            <span className="text-[10px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">
                              {t.status}
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {t.assignee?.name || "Unassigned"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Bạn có chắc chắn muốn bỏ liên kết task này?")) {
                                  unlinkTaskMutation.mutate(t.id);
                                }
                              }}
                              className="text-zinc-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                              title="Unlink"
                            >
                              <Unlink size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 italic py-1 px-1">
                    No linked target tasks (Chưa liên kết đến task nào)
                  </div>
                )}
              </div>

              {/* Tasks linking TO this task (Linked by) */}
              <div className="pt-3 border-t border-zinc-100 dark:border-white/5">
                <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  Linked by (Các task khác liên kết đến task này - Bạn sẽ nhận thông báo khi chúng đổi trạng thái)
                </div>
                {task?.targetLinks && task.targetLinks.length > 0 ? (
                  <div className="space-y-2">
                    {task.targetLinks.map((link: any) => {
                      const t = link.sourceTask;
                      if (!t) return null;
                      return (
                        <div
                          key={link.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200/60 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-950/20 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold bg-zinc-100 dark:bg-white/5 text-[10px] px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                              {t.id}
                            </span>
                            <Link
                              href={`/browse/${t.id}`}
                              className="font-medium text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate hover:underline"
                            >
                              {t.title}
                            </Link>
                          </div>
                          
                          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                            <span className="text-[10px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">
                              {t.status}
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {t.assignee?.name || "Unassigned"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 italic py-1 px-1">
                    No linking source tasks (Chưa được task nào khác liên kết)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activities Feed */}
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-white/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                Activity
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["all", "All"],
                  ["comments", "Comments"],
                  ["history", "History"],
                  ["worklog", "Work log"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivityTab(key as ActivityTab)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                      activityTab === key
                        ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        : "border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input fields for comment/worklog */}
            <div className="space-y-4">
              {(activityTab === "comments" || activityTab === "all") && (
                <CommentEditor
                  value={commentDraft}
                  onChange={setCommentDraft}
                  onSubmit={addTaskComment}
                  projectId={projectId}
                  disabled={addTaskCommentMutation.isPending}
                />
              )}

              {(activityTab === "worklog" || activityTab === "all") && (
                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/90 p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                    <input
                      value={workLogDraft}
                      onChange={(e) => setWorkLogDraft(e.target.value)}
                      placeholder="e.g. 1h 30m"
                      className="bg-transparent rounded-xl border border-zinc-200 dark:border-white/10 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      value={workLogNote}
                      onChange={(e) => setWorkLogNote(e.target.value)}
                      placeholder="Work log note (optional)"
                      className="bg-transparent rounded-xl border border-zinc-200 dark:border-white/10 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={addTaskWorkLog}
                      disabled={!workLogDraft.trim() || addTaskWorkLogMutation.isPending}
                      className="rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      Log Work
                    </button>
                  </div>
                </div>
              )}

              {/* Activities List */}
              <div className="space-y-3">
                {activitiesQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 py-4">
                    <Loader2 size={14} className="animate-spin" />
                    Loading activity log...
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 italic">
                    No activity found in this category.
                  </p>
                ) : (
                  filteredActivities.map((activity: any) => (
                    <div
                      key={activity.id}
                      className="rounded-xl border border-zinc-250/60 dark:border-white/5 bg-white dark:bg-zinc-900/40 p-4 space-y-2 hover:border-zinc-300 dark:hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            {activity.user?.name || activity.user?.email || "System"}
                          </span>
                          <span>•</span>
                          <span>{formatDateTime(activity.createdAt)}</span>
                        </div>
                        <span className="rounded-lg bg-zinc-100 dark:bg-white/5 px-2.5 py-1 font-bold text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          {activity.type === "WORK_LOG"
                            ? "Work log"
                            : activity.type === "COMMENT"
                              ? "Comment"
                              : "History"}
                        </span>
                      </div>

                      <div className="text-sm text-zinc-700 dark:text-zinc-300">
                        {activity.type === "COMMENT" && (
                          <div 
                            className="rich-text-preview text-sm"
                            dangerouslySetInnerHTML={{ 
                              __html: sanitizeRichTextHtml(activity.body || "") 
                            }} 
                          />
                        )}
                        {activity.type === "WORK_LOG" && (
                          <p className="whitespace-pre-wrap">
                            Logged <span className="font-semibold text-zinc-900 dark:text-white">{formatDuration(activity.durationHours || 0)}</span>
                            {activity.body ? `: ${activity.body}` : ""}
                          </p>
                        )}
                        {activity.type === "HISTORY" && (
                          <>
                            {activity.body ? (
                              <p className="whitespace-pre-wrap">{activity.body}</p>
                            ) : activity.field === "description" ? (
                              <div className="mt-2 space-y-2">
                                <div className="text-xs font-semibold text-zinc-500">
                                  Changed description:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5 p-3">
                                    <div className="mb-1 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Before</div>
                                    <div 
                                      className="rich-text-preview max-h-40 overflow-y-auto text-xs"
                                      dangerouslySetInnerHTML={{ 
                                        __html: sanitizeRichTextHtml(activity.fromValue || "") || "<p class='text-zinc-400 italic'>None</p>" 
                                      }} 
                                    />
                                  </div>
                                  <div className="rounded-xl border border-indigo-100 dark:border-indigo-950/20 bg-indigo-50/20 dark:bg-indigo-950/5 p-3">
                                    <div className="mb-1 text-[9px] font-bold text-indigo-400 uppercase tracking-wider">After</div>
                                    <div 
                                      className="rich-text-preview max-h-40 overflow-y-auto text-xs"
                                      dangerouslySetInnerHTML={{ 
                                        __html: sanitizeRichTextHtml(activity.toValue || "") || "<p class='text-zinc-400 italic'>None</p>" 
                                      }} 
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">
                                Changed <span className="font-semibold text-zinc-900 dark:text-white">{activity.field}</span> from{" "}
                                <span className="inline-block font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs">
                                  {activity.fromValue || "None"}
                                </span>{" "}
                                to{" "}
                                <span className="inline-block font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded text-xs">
                                  {activity.toValue || "None"}
                                </span>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sidebar Properties */}
        <aside className="space-y-6">
          {/* Task Status Section */}
          <div className="bg-card rounded-2xl border border-zinc-200 dark:border-white/5 p-5 shadow-xl relative z-20">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Status
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatusDropdown((v) => !v)}
                className="flex w-full items-center justify-between gap-1.5 rounded-xl border border-zinc-250 dark:border-white/10 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
                style={getTaskStatusInlineStyle(watch("status") || workflowStatuses[0], projectWorkflow)}
              >
                {watch("status") || workflowStatuses[0]}
                <ChevronDown size={14} />
              </button>

              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-[19]" onClick={() => setShowStatusDropdown(false)} />
                  <div className="absolute left-0 w-full z-20 mt-1 min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 py-1.5 shadow-xl">
                    {workflowStatuses.map((status: string) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setValue("status", status);
                          setShowStatusDropdown(false);
                          autoSaveTask();
                        }}
                        className="flex w-full items-center px-3.5 py-2.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <span
                          className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                          style={getTaskStatusInlineStyle(status, projectWorkflow)}
                        >
                          {status}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-card rounded-2xl border border-zinc-200 dark:border-white/5 p-5 shadow-xl space-y-4">
            <h4 className="font-semibold text-sm text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-white/5 pb-2">
              Properties
            </h4>

            {/* Assignee */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Assignee
              </label>
              <CustomSelect
                value={watch("assigneeId")}
                onChange={(val) => {
                  setValue("assigneeId", val);
                  autoSaveTask();
                }}
                options={[
                  { value: "", label: "Unassigned" },
                  ...(project?.members || []).map((m: any) => ({
                    value: m.userId.toString(),
                    label: m.user.name,
                  })),
                ]}
                placeholder="Unassigned"
                size="sm"
                className="w-full"
                buttonClassName="w-full text-left bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white py-2"
              />
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Due date
              </label>
              <div className="relative flex items-center">
                <Calendar size={14} className="absolute left-3 text-zinc-400 pointer-events-none" />
                <input
                  type="date"
                  {...register("dueDate", { onBlur: autoSaveTask })}
                  className="w-full rounded-xl border border-zinc-250 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950 pl-9 pr-3 py-2 text-sm text-zinc-950 dark:text-white hover:border-zinc-300 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Priority
              </label>
              <CustomSelect
                value={watch("priority") || "MEDIUM"}
                onChange={(val) => {
                  setValue("priority", val);
                  autoSaveTask();
                }}
                options={[
                  { value: "LOW", label: "LOW" },
                  { value: "MEDIUM", label: "MEDIUM" },
                  { value: "HIGH", label: "HIGH" },
                ]}
                placeholder="Priority"
                size="sm"
                className="w-full"
                buttonClassName="w-full text-left bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white py-2"
              />
            </div>

            {/* Epic */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Epic
              </label>
              <CustomSelect
                value={watch("epic") || ""}
                onChange={(val) => {
                  setValue("epic", val);
                  autoSaveTask();
                }}
                options={[
                  { value: "", label: "No epic" },
                  ...allEpics.map((epic: string) => ({ value: epic, label: epic })),
                ]}
                placeholder="No epic"
                size="sm"
                className="w-full"
                buttonClassName="w-full text-left bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white py-2"
              />
            </div>

            {/* Labels */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Labels
              </label>
              <input type="hidden" {...register("labels")} />
              <div className="flex min-h-[38px] flex-wrap gap-1.5 rounded-xl border border-zinc-250 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950 p-2.5">
                {allLabels.length === 0 ? (
                  <span className="text-xs text-zinc-400 italic">No labels configured</span>
                ) : (
                  allLabels.map((label: string) => {
                    const checked = selectedTaskLabels.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleTaskLabel(label)}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${
                          checked
                            ? "border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400"
                            : "border-zinc-200 dark:border-white/5 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Sprint */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Sprint
              </label>
              <CustomSelect
                value={watch("sprint") || ""}
                onChange={(val) => {
                  setValue("sprint", val);
                  autoSaveTask();
                }}
                options={[
                  { value: "", label: "No sprint" },
                  ...allSprints.map((s: string) => ({ value: s, label: s })),
                ]}
                placeholder="No sprint"
                size="sm"
                className="w-full"
                buttonClassName="w-full text-left bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white py-2"
              />
            </div>

            {/* Time Tracking */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-white/5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Time tracking
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Estimate</span>
                  <input
                    {...register("estimateInput", {
                      onBlur: autoSaveTask,
                    })}
                    placeholder="Estimate (e.g. 1d 2h)"
                    className="w-full rounded-xl border border-zinc-250 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Logged</span>
                  <input
                    {...register("loggedInput", {
                      onBlur: autoSaveTask,
                    })}
                    placeholder="Logged (e.g. 4h)"
                    className="w-full rounded-xl border border-zinc-250 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
              
              {/* Summary of Hours */}
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-500 dark:text-zinc-400 pt-2 px-1">
                <span>Total Spent: <span className="text-zinc-800 dark:text-zinc-200 font-bold">{watchedLoggedInput || "0h"}</span></span>
                <span>/</span>
                <span>Estimate: <span className="text-zinc-800 dark:text-zinc-200 font-bold">{watchedEstimateInput || "None"}</span></span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
