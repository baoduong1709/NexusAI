"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  projectsApi,
  tasksApi,
  documentsApi,
  usersApi,
  aiApi,
} from "@/lib/api";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Upload,
  FileText,
  Users,
  BrainCircuit,
  ChevronLeft,
  X,
  CheckCircle,
  Send,
  Bot,
  User,
  ListChecks,
  RefreshCw,
  History,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import {
  getAllowedTransitionStatuses,
  getTaskStatusInlineStyle,
  normalizeTaskWorkflow,
  cn,
  formatDate,
  PRIORITY_COLORS,
} from "@/lib/utils";
import {
  ProjectWorkflowEditor,
  WorkflowPreview,
} from "@/components/project-workflow-editor";
import {
  DEFAULT_PROJECT_ROLE_CONFIGS,
  getProjectRolePermissions,
  normalizeProjectRoleConfigs,
  ProjectRoleConfig,
  PROJECT_ROLE_PERMISSION_GROUPS,
} from "@/lib/project-roles";

type Tab = "tasks" | "documents" | "members" | "settings";

interface SuggestedTask {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string;
  sprint?: string;
  assigneeId?: number | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tasksCreated?: { id: number; title: string }[];
  suggestedTasks?: SuggestedTask[];
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { hasPermission, user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tasks");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [reviewTasks, setReviewTasks] = useState<SuggestedTask[] | null>(null);
  const [previewVersion, setPreviewVersion] = useState<{
    id: number;
    version: number;
    content: string;
    changesSummary: string | null;
    createdAt: string;
  } | null>(null);
  const [addMemberDialog, setAddMemberDialog] = useState<{
    userId: number;
    name: string;
  } | null>(null);
  const [addMemberRole, setAddMemberRole] = useState("");
  const [editingRole, setEditingRole] = useState<{
    userId: number;
    value: string;
  } | null>(null);
  const [roleDraft, setRoleDraft] = useState<ProjectRoleConfig[]>([]);
  const [newProjectRole, setNewProjectRole] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getOne(projectId).then((r) => r.data),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll().then((r) => r.data),
  });
  const { data: requirements, refetch: refetchReq } = useQuery({
    queryKey: ["requirements", projectId],
    queryFn: () => aiApi.getRequirements(projectId).then((r) => r.data),
    enabled: tab === "documents",
  });
  const { data: reqHistory = [] } = useQuery({
    queryKey: ["req-history", projectId],
    queryFn: () => aiApi.getHistory(projectId).then((r) => r.data),
    enabled: tab === "documents" && showHistory,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: () => {
      router.push("/projects");
      toast.success("Project deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => tasksApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task created");
      setShowTaskModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: any) =>
      tasksApi.update(projectId, taskId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task updated");
      setShowTaskModal(false);
      setEditTask(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: any) =>
      tasksApi.updateStatus(projectId, taskId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: (data: any) => projectsApi.updateWorkflow(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Workflow updated");
      setShowWorkflowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateRolesMutation = useMutation({
    mutationFn: (data: any) => projectsApi.updateRoles(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Project roles updated");
      setShowRolesModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => tasksApi.delete(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task deleted");
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => documentsApi.delete(projectId, docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Document deleted");
    },
  });

  const updateReqMutation = useMutation({
    mutationFn: () => aiApi.updateRequirements(projectId).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["requirements", projectId] });
      qc.invalidateQueries({ queryKey: ["req-history", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success(`Requirements updated - v${data.version}`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to update requirements"),
  });

  const chatMutation = useMutation({
    mutationFn: (userMsg: string) => {
      const newMessages = [
        ...chatMessages,
        { role: "user" as const, content: userMsg },
      ];
      return aiApi
        .chat(
          projectId,
          newMessages.map((m) => ({ role: m.role, content: m.content })),
        )
        .then((r) => ({ userMsg, data: r.data }));
    },
    onSuccess: ({ userMsg, data }) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: userMsg },
        {
          role: "assistant",
          content: data.message,
          suggestedTasks: data.suggestedTasks,
        },
      ]);
      if (data.suggestedTasks?.length) {
        setReviewTasks(data.suggestedTasks);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Chat failed"),
  });

  const confirmReviewMutation = useMutation({
    mutationFn: (tasks: SuggestedTask[]) =>
      aiApi.confirmTasks(projectId, tasks).then((r) => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      setReviewTasks(null);
      setChatMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.suggestedTasks
            ? {
                ...m,
                tasksCreated: created.map((t: any) => ({
                  id: t.id,
                  title: t.title,
                })),
                suggestedTasks: undefined,
              }
            : m,
        ),
      );
      toast.success(`Created ${created.length} tasks`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to create tasks"),
  });

  const sendChat = () => {
    const msg = chatInput.trim();
    if (!msg || chatMutation.isPending) return;
    setChatInput("");
    chatMutation.mutate(msg);
  };

  const addMemberMutation = useMutation({
    mutationFn: ({
      userId,
      projectRole,
    }: {
      userId: number;
      projectRole?: string;
    }) => projectsApi.addMember(projectId, userId, projectRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Member added");
      setAddMemberDialog(null);
      setAddMemberRole(projectRoles[0] || "");
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({
      userId,
      projectRole,
    }: {
      userId: number;
      projectRole: string;
    }) => projectsApi.updateMemberRole(projectId, userId, projectRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Member role updated");
      setEditingRole(null);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => projectsApi.removeMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Member removed");
    },
  });

  const { register, handleSubmit, reset } = useForm<any>();
  const projectRoleConfigs = normalizeProjectRoleConfigs(
    project?.projectRoleConfigs?.length
      ? project.projectRoleConfigs
      : project?.projectRoles,
  );
  const projectRoles = projectRoleConfigs.map((role) => role.name);
  const workflowStatuses =
    project?.taskStatuses?.length > 0
      ? project.taskStatuses
      : ["TODO", "IN_PROGRESS", "DONE"];
  const projectWorkflow = normalizeTaskWorkflow(
    project?.taskWorkflow,
    workflowStatuses,
  );
  const currentMember = project?.members?.find((member: any) => member.userId === user?.id);
  const currentProjectPermissions = Array.from(
    new Set([
      ...((currentMember?.projectRole
        ? getProjectRolePermissions(projectRoleConfigs, currentMember.projectRole)
        : []) || []),
      ...(user?.role?.permissions || []),
    ]),
  );
  const canProject = (permission: string) =>
    hasPermission(permission) || currentProjectPermissions.includes(permission);
  const tabs = [
    { key: "tasks", label: "Tasks", icon: CheckCircle },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "members", label: "Members", icon: Users },
    ...(canProject("project:update")
      ? [{ key: "settings", label: "Settings", icon: Settings2 }]
      : []),
  ] as const;

  const openCreateTask = () => {
    reset({
      title: "",
      description: "",
      priority: "MEDIUM",
      assigneeId: "",
      status: workflowStatuses[0],
      dueDate: "",
      sprint: "",
    });
    setEditTask(null);
    setShowTaskModal(true);
  };

  const openEditTask = (t: any) => {
    reset({
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assigneeId: t.assignee?.id || "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
      sprint: t.sprint || "",
    });
    setEditTask(t);
    setShowTaskModal(true);
  };

  const onTaskSubmit = (data: any) => {
    const payload = {
      ...data,
      assigneeId: data.assigneeId ? Number(data.assigneeId) : undefined,
      dueDate: data.dueDate || undefined,
      sprint: data.sprint?.trim() || undefined,
      status: data.status || undefined,
    };
    if (editTask)
      updateTaskMutation.mutate({ taskId: editTask.id, data: payload });
    else createTaskMutation.mutate(payload);
  };

  const openWorkflowEditor = () => setShowWorkflowModal(true);
  const openRolesEditor = () => {
    setRoleDraft(projectRoleConfigs);
    setNewProjectRole("");
    setShowRolesModal(true);
  };

  const saveProjectRoles = () => {
    const normalized = normalizeProjectRoleConfigs(roleDraft);

    if (!normalized.length) {
      toast.error("The project must have at least one role");
      return;
    }

    if (
      new Set(normalized.map((role) => role.name.toLowerCase())).size !==
      normalized.length
    ) {
      toast.error("Project roles must be unique");
      return;
    }

    updateRolesMutation.mutate({ roles: normalized });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      await documentsApi.upload(projectId, file);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Upload successful");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const memberIds = new Set(project?.members?.map((m: any) => m.userId));

  if (isLoading)
    return (
      <div className='py-12 flex justify-center'>
        <Loader2 className='animate-spin text-blue-500' />
      </div>
    );
  if (!project)
    return (
      <div className='text-center py-12 text-gray-500'>
        Project not found
      </div>
    );

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <button
          onClick={() => router.push("/projects")}
          className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg'
        >
          <ChevronLeft size={20} />
        </button>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold text-gray-900'>{project.name}</h1>
          {project.description && (
            <p className='text-gray-500 text-sm mt-0.5'>
              {project.description}
            </p>
          )}
        </div>
        {canProject("project:delete") && (
          <button
            onClick={() =>
              confirm("Delete this project?") && deleteProjectMutation.mutate()
            }
            className='p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg'
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className='flex gap-4 text-sm text-gray-500'>
        <span>{project.members?.length} members</span>
        <span>|</span>
        <span>{project.tasks?.length} tasks</span>
        <span>|</span>
        <span>{project.documents?.length} documents</span>
        {project.startDate && (
          <>
            <span>|</span>
            <span>Start date: {formatDate(project.startDate)}</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className='flex border-b border-gray-200'>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {tab === "tasks" && (
        <div className='space-y-3'>
          {canProject("task:create") && (
            <div className='flex justify-end'>
              <button
                onClick={openCreateTask}
                className='flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm'
              >
                <Plus size={16} /> Add task
              </button>
            </div>
          )}
          {project.tasks?.length === 0 ? (
            <p className='text-center text-gray-400 py-8'>No tasks yet</p>
          ) : (
            <div className='bg-white rounded-xl border border-gray-100 overflow-hidden'>
              <table className='w-full'>
                <thead className='bg-gray-50 border-b border-gray-100'>
                  <tr>
                    {[
                      "Title",
                      "Assignee",
                      "Priority",
                      "Sprint",
                      "Deadline",
                      "Status",
                      "AI",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className='px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase'
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {project.tasks.map((t: any) => (
                    <tr key={t.id} className='hover:bg-gray-50'>
                      <td className='px-4 py-3'>
                        <p className='font-medium text-gray-900 text-sm'>
                          {t.title}
                        </p>
                        {t.description && (
                          <p className='text-xs text-gray-400 line-clamp-1 mt-0.5'>
                            {t.description}
                          </p>
                        )}
                      </td>
                      <td className='px-4 py-3 text-sm text-gray-500'>
                        {t.assignee?.name || "-"}
                      </td>
                      <td className='px-4 py-3'>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            PRIORITY_COLORS[
                              t.priority as keyof typeof PRIORITY_COLORS
                            ],
                          )}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className='px-4 py-3 text-xs text-gray-500'>
                        {t.sprint || "-"}
                      </td>
                      <td className='px-4 py-3 text-xs text-gray-500'>
                        {t.dueDate ? formatDate(t.dueDate) : "-"}
                      </td>
                      <td className='px-4 py-3'>
                        {canProject("task:update") ? (
                          <select
                            value={t.status}
                            onChange={(e) =>
                              updateStatusMutation.mutate({
                                taskId: t.id,
                                status: e.target.value,
                              })
                            }
                            className='text-xs px-2.5 py-1 rounded-full font-medium border focus:outline-none focus:ring-2 focus:ring-blue-300'
                            style={getTaskStatusInlineStyle(t.status, projectWorkflow)}
                          >
                            {getAllowedTransitionStatuses(projectWorkflow, t.status).map((status: string) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className='text-xs px-2.5 py-1 rounded-full font-medium border'
                            style={getTaskStatusInlineStyle(t.status, projectWorkflow)}
                          >
                            {t.status}
                          </span>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        {t.isAiGenerated && (
                          <span className='text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full'>
                            AI
                          </span>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex gap-1 justify-end'>
                          {canProject("task:update") && (
                            <button
                              onClick={() => openEditTask(t)}
                              className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded'
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canProject("task:delete") && (
                            <button
                              onClick={() =>
                                confirm("Delete this task?") &&
                                deleteTaskMutation.mutate(t.id)
                              }
                              className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded'
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab === "documents" && (
        <div className='flex gap-4 h-[calc(100vh-18rem)]'>
          {/* Left: Requirements + File list */}
          <div className='flex-1 flex flex-col gap-3 overflow-hidden'>
            {/* Requirements header */}
            <div className='flex items-center gap-2'>
              <div className='flex items-center gap-2 flex-1'>
                <BrainCircuit className='text-purple-500' size={16} />
                <span className='font-semibold text-gray-800 text-sm'>
                  Requirements
                </span>
                {requirements?.version && (
                  <span className='text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full'>
                    v{requirements.version}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowHistory((v) => !v)}
                className='flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border rounded-lg px-2 py-1'
              >
                <History size={12} /> History{" "}
                <ChevronDown
                  size={11}
                  className={cn(
                    "transition-transform",
                    showHistory && "rotate-180",
                  )}
                />
              </button>
              {canProject("ai:analyze") && (
                <button
                  onClick={() => updateReqMutation.mutate()}
                  disabled={updateReqMutation.isPending}
                  className='flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50'
                >
                  {updateReqMutation.isPending ? (
                    <Loader2 size={12} className='animate-spin' />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Update Requirements
                </button>
              )}
            </div>

            {/* History dropdown */}
            {showHistory && (
              <div className='bg-white border border-gray-100 rounded-xl p-3'>
                <p className='text-xs font-semibold text-gray-500 mb-2'>
                  Version history
                </p>
                {(reqHistory as any[]).length === 0 ? (
                  <p className='text-xs text-gray-400'>No history yet</p>
                ) : (
                  <div className='space-y-2'>
                    {(reqHistory as any[]).map((h: any) => (
                      <div
                        key={h.id}
                        className='border border-gray-100 rounded-lg p-2 hover:border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer'
                        onClick={() =>
                          aiApi
                            .getVersion(projectId, h.id)
                            .then((r) => setPreviewVersion(r.data))
                        }
                      >
                        <div className='flex items-center justify-between mb-1'>
                          <span className='text-xs font-semibold text-purple-700'>
                            v{h.version}
                          </span>
                          <span className='text-xs text-gray-400'>
                            {formatDate(h.createdAt)}
                          </span>
                        </div>
                        {h.changesSummary ? (
                          <p className='text-xs text-gray-500 whitespace-pre-line leading-relaxed'>
                            {h.changesSummary}
                          </p>
                        ) : (
                          <p className='text-xs text-gray-400 italic'>
                            Initial version
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Requirements content */}
            <div className='flex-1 bg-white border border-gray-100 rounded-xl p-4 overflow-y-auto'>
              {requirements?.content ? (
                <pre className='text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed'>
                  {requirements.content}
                </pre>
              ) : (
                <div className='flex flex-col items-center justify-center h-full text-gray-400'>
                  <FileText size={32} className='mb-2 opacity-40' />
                  <p className='text-sm'>No requirements yet</p>
                  <p className='text-xs mt-1'>
                    Click "Update Requirements" to generate them with AI
                  </p>
                </div>
              )}
            </div>

            {/* Uploaded files */}
            <div className='flex-shrink-0'>
              <div className='flex items-center justify-between mb-2'>
                <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                  Uploaded documents
                </p>
                {canProject("document:upload") && (
                  <label
                    className={cn(
                      "flex items-center gap-1.5 text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 cursor-pointer",
                      uploading && "opacity-50",
                    )}
                  >
                    {uploading ? (
                      <Loader2 className='animate-spin' size={12} />
                    ) : (
                      <Upload size={12} />
                    )}
                    Upload
                    <input
                      type='file'
                      className='hidden'
                      accept='.pdf,.docx,.doc,.txt'
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
              <div className='space-y-1.5 max-h-40 overflow-y-auto'>
                {project.documents?.filter(
                  (d: any) => d.originalName !== "requirements.md",
                ).length === 0 ? (
                  <p className='text-xs text-gray-400 text-center py-2'>
                    No documents yet
                  </p>
                ) : (
                  project.documents
                    ?.filter((d: any) => d.originalName !== "requirements.md")
                    .map((d: any) => (
                      <div
                        key={d.id}
                        className='bg-white border border-gray-100 rounded-lg px-3 py-2 flex items-center gap-2'
                      >
                        <FileText
                          className='text-blue-400 flex-shrink-0'
                          size={14}
                        />
                        <div className='flex-1 min-w-0'>
                          <p className='text-xs font-medium text-gray-800 truncate'>
                            {d.originalName}
                          </p>
                          <p className='text-xs text-gray-400'>
                            {(d.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        {canProject("document:delete") && (
                          <button
                            onClick={() =>
                              confirm("Delete?") && deleteDocMutation.mutate(d.id)
                            }
                            className='p-1 text-gray-300 hover:text-red-500 flex-shrink-0'
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Right: AI Chat */}
          {canProject("ai:analyze") && (
            <div className='w-80 flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden'>
              <div className='px-4 py-3 border-b border-gray-100 flex items-center gap-2 bg-purple-50'>
                <BrainCircuit className='text-purple-600' size={16} />
                <span className='text-sm font-semibold text-purple-900'>
                  AI Assistant
                </span>
              </div>

              <div className='flex-1 overflow-y-auto p-3 space-y-3'>
                {chatMessages.length === 0 && (
                  <div className='text-center py-6'>
                    <Bot size={28} className='text-purple-200 mx-auto mb-2' />
                    <p className='text-xs text-gray-400'>
                      Chat with AI to generate tasks
                    </p>
                    <p className='text-xs text-gray-300 mt-1'>
                      Example: "Create tasks for the login module"
                    </p>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className='w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                        <Bot size={12} className='text-purple-600' />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100",
                      )}
                    >
                      {msg.content}
                      {msg.suggestedTasks?.length ? (
                        <div className='mt-2 pt-2 border-t border-purple-200/50'>
                          <button
                            onClick={() => setReviewTasks(msg.suggestedTasks!)}
                            className='flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900'
                          >
                            <ListChecks size={11} />
                            Review {msg.suggestedTasks.length} suggested tasks
                          </button>
                        </div>
                      ) : null}
                      {msg.tasksCreated?.length ? (
                        <div className='mt-2 pt-2 border-t border-gray-200/50'>
                          <p className='font-semibold text-green-700 flex items-center gap-1 mb-1'>
                            <ListChecks size={11} /> Created:
                          </p>
                          {msg.tasksCreated.map((t) => (
                            <p
                              key={t.id}
                              className='text-green-700 flex items-center gap-1'
                            >
                              <CheckCircle size={10} /> {t.title}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {msg.role === "user" && (
                      <div className='w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                        <User size={12} className='text-blue-600' />
                      </div>
                    )}
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className='flex gap-2'>
                    <div className='w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0'>
                      <Bot size={12} className='text-purple-600' />
                    </div>
                    <div className='bg-gray-50 border border-gray-100 rounded-xl px-3 py-2'>
                      <Loader2
                        size={12}
                        className='animate-spin text-purple-400'
                      />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className='p-3 border-t border-gray-100 flex gap-2'>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder='Type your prompt...'
                  rows={2}
                  className='flex-1 resize-none text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400'
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatMutation.isPending}
                  className='flex-shrink-0 bg-purple-600 text-white px-3 rounded-lg hover:bg-purple-700 disabled:opacity-40'
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && canProject("project:update") && (
        <div className='space-y-4'>
          <div className='bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='max-w-2xl space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-400'>
                Project Settings
              </p>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>
                  Project task workflow
                </h2>
                <p className='text-sm text-gray-500 mt-1'>
                  The workflow has been moved out of the task screen. Only members with project settings access can view and edit it.
                </p>
              </div>
            </div>
            <div className='flex gap-2'>
              <button
                onClick={openWorkflowEditor}
                className='px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700'
              >
                Edit workflow
              </button>
            </div>
          </div>

          <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
            <div className='px-5 py-4 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-400'>
                  Workflow Canvas
                </p>
                <p className='text-sm text-gray-500 mt-1'>
                  Drag statuses, connect transitions, and color each node in the builder.
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                {projectWorkflow.nodes.map((node) => (
                  <span
                    key={node.id}
                    className='text-xs px-2.5 py-1 rounded-full font-medium border'
                    style={getTaskStatusInlineStyle(node.name, projectWorkflow)}
                  >
                    {node.name}
                  </span>
                ))}
              </div>
            </div>
            <div className='p-5'>
              <WorkflowPreview
                workflow={projectWorkflow}
                className='h-[360px] w-full rounded-2xl border border-slate-200 bg-slate-50'
              />
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {tab === "members" && (
        <div className='space-y-3'>
          <div className='bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
            <div className='space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-wide text-gray-500'>
                Project roles
              </p>
              <div className='flex flex-wrap gap-2'>
                {projectRoles.map((role: string) => (
                  <span
                    key={role}
                    className='text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium'
                  >
                    {role}
                  </span>
                ))}
              </div>
              <p className='text-xs text-gray-400'>
                Project managers can create and name custom roles for each project.
              </p>
            </div>
            {canProject("project:update") && (
              <button
                onClick={openRolesEditor}
                className='self-start px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50'
              >
                Manage roles
              </button>
            )}
          </div>
          {canProject("project:update") && (
            <div>
              <p className='text-sm font-medium text-gray-700 mb-2'>
                Add member
              </p>
              <div className='flex flex-wrap gap-2'>
                {users
                  .filter((u: any) => !memberIds.has(u.id))
                  .map((u: any) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setAddMemberDialog({ userId: u.id, name: u.name });
                        setAddMemberRole(projectRoles[0] || "");
                      }}
                      className='flex items-center gap-2 px-3 py-1.5 border border-dashed border-gray-300 rounded-full text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors'
                    >
                      <Plus size={12} /> {u.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div className='bg-white rounded-xl border border-gray-100 divide-y divide-gray-50'>
            {project.members?.length === 0 ? (
              <p className='text-center text-gray-400 py-8'>
                No members yet
              </p>
            ) : (
              project.members.map((m: any) => (
                <div
                  key={m.userId}
                  className='px-4 py-3 flex items-center gap-3'
                >
                  <div className='bg-blue-100 text-blue-700 font-semibold rounded-full w-8 h-8 flex items-center justify-center text-xs flex-shrink-0'>
                    {m.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className='flex-1'>
                    <p className='font-medium text-gray-900 text-sm'>
                      {m.user.name}
                    </p>
                    {editingRole?.userId === m.userId ? (
                      <div className='flex items-center gap-1.5 mt-0.5'>
                        <select
                          value={editingRole!.value}
                          onChange={(e) =>
                            setEditingRole({
                              userId: m.userId,
                              value: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              updateMemberRoleMutation.mutate({
                                userId: m.userId,
                                projectRole: editingRole!.value,
                              });
                            if (e.key === "Escape") setEditingRole(null);
                          }}
                          className='text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36'
                        >
                          {projectRoles.map((role: string) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            updateMemberRoleMutation.mutate({
                              userId: m.userId,
                              projectRole: editingRole!.value,
                            })
                          }
                          className='text-xs text-blue-600 hover:text-blue-800 font-medium'
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingRole(null)}
                          className='text-xs text-gray-400 hover:text-gray-600'
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className='flex items-center gap-1 mt-0.5'>
                        <span className='text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full'>
                          {m.projectRole ||
                            m.user.role?.name ||
                            "No role assigned"}
                        </span>
                        {canProject("project:update") && (
                          <button
                            onClick={() =>
                              setEditingRole({
                                userId: m.userId,
                                value:
                                  (m.projectRole &&
                                  projectRoles.includes(m.projectRole)
                                    ? m.projectRole
                                    : projectRoles[0]) || "",
                              })
                            }
                            className='p-0.5 text-gray-300 hover:text-blue-500'
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {canProject("project:update") && (
                    <button
                      onClick={() => removeMemberMutation.mutate(m.userId)}
                      className='p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded'
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      {addMemberDialog && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6'>
            <h3 className='font-semibold text-gray-900 mb-1'>
              Add member
            </h3>
            <p className='text-sm text-gray-500 mb-4'>
              Set the role for{" "}
              <span className='font-medium text-gray-800'>
                {addMemberDialog.name}
              </span>{" "}
              in this project.
            </p>
            <div className='space-y-3'>
              <div>
                <label className='text-xs font-medium text-gray-600 block mb-1'>
                  Project role
                </label>
                {canProject("project:update") && (
                  <div className='flex justify-end mb-1'>
                    <button
                      type='button'
                      onClick={() => {
                        setAddMemberDialog(null);
                        openRolesEditor();
                      }}
                      className='text-xs text-blue-600 hover:text-blue-700'
                    >
                      Manage roles
                    </button>
                  </div>
                )}
                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value)}
                  className='w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400'
                >
                  {projectRoles.map((role: string) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className='flex gap-2 mt-5'>
              <button
                onClick={() => setAddMemberDialog(null)}
                className='flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  addMemberMutation.mutate({
                    userId: addMemberDialog.userId,
                    projectRole: addMemberRole,
                  })
                }
                disabled={addMemberMutation.isPending}
                className='flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2'
              >
                {addMemberMutation.isPending && (
                  <Loader2 size={13} className='animate-spin' />
                )}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {/* AI Task Review Modal */}
      {reviewTasks && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0'>
              <div className='flex items-center gap-2'>
                <BrainCircuit size={16} className='text-purple-500' />
                <span className='font-semibold text-gray-900'>
                  Review suggested tasks
                </span>
                <span className='text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold'>
                  {reviewTasks.length} tasks
                </span>
              </div>
              <button
                onClick={() => setReviewTasks(null)}
                className='text-gray-400 hover:text-gray-700'
              >
                <X size={18} />
              </button>
            </div>

            <div className='flex-1 overflow-y-auto p-4 space-y-3'>
              {reviewTasks.map((task, idx) => (
                <div
                  key={idx}
                  className='border border-gray-200 rounded-xl p-4 space-y-3'
                >
                  <div className='flex items-start gap-2'>
                    <span className='text-xs font-bold text-gray-400 mt-2 w-5 flex-shrink-0'>
                      {idx + 1}
                    </span>
                    <input
                      value={task.title}
                      onChange={(e) =>
                        setReviewTasks((prev) =>
                          prev!.map((t, i) =>
                            i === idx ? { ...t, title: e.target.value } : t,
                          ),
                        )
                      }
                      className='flex-1 text-sm font-semibold border-0 border-b border-gray-200 focus:outline-none focus:border-purple-400 py-1'
                      placeholder='Task title *'
                    />
                    <button
                      onClick={() =>
                        setReviewTasks((prev) =>
                          prev!.filter((_, i) => i !== idx),
                        )
                      }
                      className='text-gray-300 hover:text-red-500 flex-shrink-0'
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <textarea
                    value={task.description || ""}
                    onChange={(e) =>
                      setReviewTasks((prev) =>
                        prev!.map((t, i) =>
                          i === idx ? { ...t, description: e.target.value } : t,
                        ),
                      )
                    }
                    rows={2}
                    className='w-full text-xs border border-gray-100 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 text-gray-600 ml-7'
                    placeholder='Task description...'
                  />

                  <div className='grid grid-cols-4 gap-2 ml-7'>
                    <div>
                      <p className='text-xs text-gray-400 mb-1'>Priority</p>
                      <select
                        value={task.priority || "MEDIUM"}
                        onChange={(e) =>
                          setReviewTasks((prev) =>
                            prev!.map((t, i) =>
                              i === idx
                                ? { ...t, priority: e.target.value as any }
                                : t,
                            ),
                          )
                        }
                        className='w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300'
                      >
                        <option value='HIGH'>HIGH</option>
                        <option value='MEDIUM'>MEDIUM</option>
                        <option value='LOW'>LOW</option>
                      </select>
                    </div>
                    <div>
                      <p className='text-xs text-gray-400 mb-1'>Deadline</p>
                      <input
                        type='date'
                        value={task.dueDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setReviewTasks((prev) =>
                            prev!.map((t, i) =>
                              i === idx
                                ? { ...t, dueDate: e.target.value || undefined }
                                : t,
                            ),
                          )
                        }
                        className='w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300'
                      />
                    </div>
                    <div>
                      <p className='text-xs text-gray-400 mb-1'>Sprint</p>
                      <input
                        type='text'
                        value={task.sprint || ""}
                        onChange={(e) =>
                          setReviewTasks((prev) =>
                            prev!.map((t, i) =>
                              i === idx
                                ? { ...t, sprint: e.target.value || undefined }
                                : t,
                            ),
                          )
                        }
                        placeholder='Sprint 1'
                        className='w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300'
                      />
                    </div>
                    <div>
                      <p className='text-xs text-gray-400 mb-1'>Assignee</p>
                      <select
                        value={task.assigneeId ?? ""}
                        onChange={(e) =>
                          setReviewTasks((prev) =>
                            prev!.map((t, i) =>
                              i === idx
                                ? {
                                    ...t,
                                    assigneeId: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }
                                : t,
                            ),
                          )
                        }
                        className='w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300'
                      >
                        <option value=''>- Unassigned</option>
                        {(project?.members || []).map((m: any) => (
                          <option key={m.userId} value={m.userId}>
                            {m.user?.name || `User ${m.userId}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {reviewTasks.length === 0 && (
                <p className='text-center text-sm text-gray-400 py-8'>
                  All tasks were removed
                </p>
              )}
            </div>

            <div className='flex items-center justify-between px-5 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50 rounded-b-2xl'>
              <button
                onClick={() => setReviewTasks(null)}
                className='text-sm text-gray-500 hover:text-gray-700 px-4 py-2'
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  reviewTasks.length > 0 &&
                  confirmReviewMutation.mutate(reviewTasks)
                }
                disabled={
                  reviewTasks.length === 0 || confirmReviewMutation.isPending
                }
                className='flex items-center gap-2 bg-purple-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-purple-700 disabled:opacity-50'
              >
                {confirmReviewMutation.isPending ? (
                  <Loader2 size={14} className='animate-spin' />
                ) : (
                  <CheckCircle size={14} />
                )}
                Create {reviewTasks.length} tasks
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Version Preview Modal */}
      {previewVersion && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
          onClick={() => setPreviewVersion(null)}
        >
          <div
            className='bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <History size={16} className='text-purple-500' />
                <span className='font-semibold text-gray-900 text-sm'>
                  Version v{previewVersion.version}
                </span>
                <span className='text-xs text-gray-400'>
                  | {formatDate(previewVersion.createdAt)}
                </span>
              </div>
              <button
                onClick={() => setPreviewVersion(null)}
                className='text-gray-400 hover:text-gray-700'
              >
                <X size={18} />
              </button>
            </div>
            {previewVersion.changesSummary && (
              <div className='px-5 py-3 bg-amber-50 border-b border-amber-100'>
                <p className='text-xs font-semibold text-amber-700 mb-1'>
                  Changes from the previous version
                </p>
                <p className='text-xs text-amber-800 whitespace-pre-line leading-relaxed'>
                  {previewVersion.changesSummary}
                </p>
              </div>
            )}
            <div className='flex-1 overflow-y-auto p-5'>
              <pre className='text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed'>
                {previewVersion.content}
              </pre>
            </div>
          </div>
        </div>
      )}
      <ProjectWorkflowEditor
        open={showWorkflowModal}
        initialWorkflow={projectWorkflow}
        isSaving={updateWorkflowMutation.isPending}
        onClose={() => setShowWorkflowModal(false)}
        onSave={(workflow) => updateWorkflowMutation.mutate(workflow)}
      />
      {showRolesModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
              <div>
                <h3 className='font-semibold text-gray-900'>Project roles</h3>
                <p className='text-sm text-gray-500'>
                  Create custom project roles and define permissions for each one.
                </p>
              </div>
              <button
                onClick={() => setShowRolesModal(false)}
                className='text-gray-400 hover:text-gray-700'
              >
                <X size={18} />
              </button>
            </div>

            <div className='flex-1 overflow-y-auto p-5 space-y-3'>
              {roleDraft.map((role, index) => (
                <div
                  key={`${role.name}-${index}`}
                  className='border border-gray-200 rounded-xl p-3 space-y-3'
                >
                  <div className='flex items-center gap-2'>
                    <span className='w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center'>
                      {index + 1}
                    </span>
                    <input
                      value={role.name}
                      onChange={(e) =>
                        setRoleDraft((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className='flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
                      placeholder='Role name'
                    />
                    <button
                      type='button'
                      disabled={roleDraft.length === 1}
                      onClick={() =>
                        setRoleDraft((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className='px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg disabled:opacity-40'
                    >
                      Delete
                    </button>
                  </div>
                  <div className='space-y-2'>
                    {PROJECT_ROLE_PERMISSION_GROUPS.map((group) => (
                      <div key={`${role.name}-${group.label}`}>
                        <p className='text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5'>
                          {group.label}
                        </p>
                        <div className='flex flex-wrap gap-2'>
                          {group.permissions.map((permission) => {
                            const checked = role.permissions.includes(permission);

                            return (
                              <button
                                key={permission}
                                type='button'
                                onClick={() =>
                                  setRoleDraft((prev) =>
                                    prev.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            permissions: checked
                                              ? item.permissions.filter(
                                                  (value) => value !== permission,
                                                )
                                              : [...item.permissions, permission],
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className={cn(
                                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                                  checked
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300",
                                )}
                              >
                                {permission}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className='border border-dashed border-gray-300 rounded-xl p-3 flex items-center gap-2'>
                <input
                  value={newProjectRole}
                  onChange={(e) => setNewProjectRole(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const role = newProjectRole.trim();
                      if (!role) return;
                      setRoleDraft((prev) => [
                        ...prev,
                        { name: role, permissions: [] },
                      ]);
                      setNewProjectRole("");
                    }
                  }}
                  className='flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
                  placeholder='Add a new role...'
                />
                <button
                  type='button'
                  onClick={() => {
                    const role = newProjectRole.trim();
                    if (!role) return;
                    setRoleDraft((prev) => [
                      ...prev,
                      { name: role, permissions: [] },
                    ]);
                    setNewProjectRole("");
                  }}
                  className='px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                >
                  Add
                </button>
              </div>

              <p className='text-xs text-gray-400'>
                Each role can enable or disable individual actions in the project. If a role is still assigned to members, the backend blocks deletion until those members are reassigned.
              </p>
            </div>

            <div className='flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl'>
              <button
                type='button'
                onClick={() => setShowRolesModal(false)}
                className='px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={saveProjectRoles}
                disabled={updateRolesMutation.isPending}
                className='px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2'
              >
                {updateRolesMutation.isPending && (
                  <Loader2 size={14} className='animate-spin' />
                )}
                Save roles
              </button>
            </div>
          </div>
        </div>
      )}
      {showTaskModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md'>
            <h3 className='font-bold text-lg text-gray-900 mb-4'>
              {editTask ? "Update task" : "Add new task"}
            </h3>
            <form onSubmit={handleSubmit(onTaskSubmit)} className='space-y-3'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Title *
                </label>
                <input
                  {...register("title", { required: true })}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Status
                </label>
                <select
                  {...register("status")}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {workflowStatuses.map((status: string) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-sm font-medium text-gray-700'>
                    Priority
                  </label>
                  <select
                    {...register("priority")}
                    className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value='LOW'>LOW</option>
                    <option value='MEDIUM'>MEDIUM</option>
                    <option value='HIGH'>HIGH</option>
                  </select>
                </div>
                <div>
                  <label className='text-sm font-medium text-gray-700'>
                    Assignee
                  </label>
                  <select
                    {...register("assigneeId")}
                    className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>- Unassigned -</option>
                    {project.members?.map((m: any) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-sm font-medium text-gray-700'>
                    Deadline
                  </label>
                  <input
                    type='date'
                    {...register("dueDate")}
                    className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='text-sm font-medium text-gray-700'>
                    Sprint
                  </label>
                  <input
                    type='text'
                    {...register("sprint")}
                    placeholder='Sprint 1'
                    className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
              </div>
              <div className='flex gap-2 justify-end mt-4'>
                <button
                  type='button'
                  onClick={() => {
                    setShowTaskModal(false);
                    setEditTask(null);
                  }}
                  className='px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={
                    createTaskMutation.isPending || updateTaskMutation.isPending
                  }
                  className='px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50'
                >
                  {(createTaskMutation.isPending ||
                    updateTaskMutation.isPending) && (
                    <Loader2 className='animate-spin' size={14} />
                  )}
                  {editTask ? "Update" : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

