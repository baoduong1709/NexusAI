"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  projectsApi,
  tasksApi,
  documentsApi,
  usersApi,
  aiApi,
} from "@/lib/api";
import AccessDenied from "@/components/layout/access-denied";
import { toast } from "sonner";
import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TiptapImage from "@tiptap/extension-image";
import { Image as LucideImage } from "lucide-react";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Upload,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
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
  BarChart2,
  GitBranch,
  LayoutGrid,
  CalendarDays,
  Layers,
  Tags,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code2,
  Undo2,
  Redo2,
  WandSparkles,
  Minus,
  CheckSquare,
  Copy,
  Terminal,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import {
  getAllowedTransitionStatuses,
  getTaskStatusInlineStyle,
  normalizeTaskWorkflow,
  cn,
  formatDate,
  formatDateTime,
  PRIORITY_COLORS,
  stripHtmlTags,
  toHours,
  durationFromHours,
  durationToHours,
  parseDurationInput,
  formatDuration,
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
import { BrandLogo } from "@/components/brand-logo";
import { motion, AnimatePresence } from "framer-motion";
import { DescriptionEditor, sanitizeRichTextHtml } from "@/components/project/description-editor";
import { CommentEditor, isHtmlEmpty } from "@/components/project/comment-editor";
import { ProjectDocuments } from "@/components/project/tabs/project-documents";
import { ProjectMembers } from "@/components/project/tabs/project-members";
import { ProjectBoard } from "@/components/project/tabs/project-board";
import { useProjectWebsocket } from "@/lib/websocket";
import { ProjectHeader } from "@/components/project/project-header";
import { TaskFilters } from "@/components/project/task-filters";
import { TaskLinearList } from "@/components/project/task-linear-list";



type Tab =
  | "summary"
  | "timeline"
  | "backlog"
  | "board"
  | "calendar"
  | "documents"
  | "members"
  | "settings";

const HOURS_PER_WORK_DAY = 8;

interface SuggestedTask {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string;
  epic?: string;
  labels?: string[];
  sprint?: string;
  estimateHours?: number;
  loggedHours?: number;
  assigneeId?: number | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tasksCreated?: { id: string; title: string }[];
  suggestedTasks?: SuggestedTask[];
  agentLogs?: { type: string; name: string; duration: number; details?: string }[];
}

interface DescriptionAiMessage {
  role: "user" | "assistant";
  content: string;
}

type ActivityTab = "all" | "comments" | "history" | "worklog";

interface TaskActivity {
  id: number;
  type: "COMMENT" | "HISTORY" | "WORK_LOG";
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  body?: string | null;
  durationHours?: number | null;
  createdAt: string;
  user?: { id: number; name: string; email: string } | null;
}

const InfoPanelNode = Node.create({
  name: "infoPanel",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      panelType: {
        default: "info",
        parseHTML: (element) =>
          element.getAttribute("data-panel-type") || "info",
        renderHTML: (attributes) => ({
          "data-panel-type": attributes.panelType || "info",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-node-type="info-panel"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "info-panel",
      }),
      0,
    ];
  },
});

const DateBadgeNode = Node.create({
  name: "dateBadge",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      value: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-value") || "",
        renderHTML: (attributes) => ({
          "data-value": attributes.value || "",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-node-type="date-badge"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const value = HTMLAttributes["data-value"] || HTMLAttributes.value || "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "date-badge",
      }),
      value ? `Date: ${value}` : "Date",
    ];
  },
});

const StatusBadgeNode = Node.create({
  name: "statusBadge",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      value: {
        default: "TODO",
        parseHTML: (element) => element.getAttribute("data-value") || "TODO",
        renderHTML: (attributes) => ({
          "data-value": attributes.value || "TODO",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-node-type="status-badge"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const value =
      HTMLAttributes["data-value"] || HTMLAttributes.value || "TODO";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "status-badge",
      }),
      value,
    ];
  },
});

function ExpandBlockView({ node, updateAttributes }: any) {
  return (
    <NodeViewWrapper
      as='details'
      data-node-type='expand-block'
      data-summary={node.attrs.summary}
      data-body={node.attrs.body}
      open
      className='expand-block-node'
    >
      <summary aria-label='Expand details' />
      <textarea
        value={node.attrs.body || ""}
        onChange={(e) => updateAttributes({ body: e.target.value })}
        className='mt-2 min-h-[72px] w-full resize-y rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-sky-400'
        placeholder='Details content...'
      />
    </NodeViewWrapper>
  );
}

const ExpandBlockNode = Node.create({
  name: "expandBlock",
  group: "block",
  atom: true,
  defining: true,
  addAttributes() {
    return {
      summary: {
        default: "Expand",
        parseHTML: (element) =>
          element.getAttribute("data-summary") ||
          element.querySelector("summary")?.textContent ||
          "Expand",
        renderHTML: (attributes) => ({
          "data-summary": attributes.summary || "Expand",
        }),
      },
      body: {
        default: "Details content...",
        parseHTML: (element) =>
          element.getAttribute("data-body") ||
          element.querySelector("[data-expand-body]")?.textContent ||
          "Details content...",
        renderHTML: (attributes) => ({
          "data-body": attributes.body || "Details content...",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'details[data-node-type="expand-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const summary =
      HTMLAttributes["data-summary"] || HTMLAttributes.summary || "Expand";
    const body =
      HTMLAttributes["data-body"] ||
      HTMLAttributes.body ||
      "Details content...";
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "expand-block",
      }),
      ["summary", {}, summary],
      ["div", { "data-expand-body": "" }, body],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ExpandBlockView);
  },
});

function parseTaskLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((label) => String(label).trim()).filter(Boolean)),
    );
  }

  if (typeof value !== "string") return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  );
}

function stripTaskPrefix(title: string) {
  return title.replace(/^(\[[^\]]+\]\s*)+/, "").trim();
}

function previewTaskNamingRule(
  rule: string,
  sample: {
    title: string;
    epic?: string;
    labels?: string[];
    sprint?: string;
    priority?: string;
  },
) {
  const title = stripTaskPrefix(sample.title);
  if (!rule.trim()) return title;

  const labels = sample.labels || [];
  const rendered = rule
    .replaceAll("{title}", title)
    .replaceAll("{epic}", sample.epic || "")
    .replaceAll("{labels}", labels.join("]["))
    .replaceAll("{firstLabel}", labels[0] || "")
    .replaceAll("{remainingLabels}", labels.slice(1).join("]["))
    .replaceAll("{sprint}", sample.sprint || "")
    .replaceAll("{priority}", sample.priority || "");

  return rendered.replace(/\[\]/g, "").replace(/\s+/g, " ").trim();
}



export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { hasPermission, user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("summary");
  const [docSubTab, setDocSubTab] = useState<"requirements" | "files">("requirements");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [showUpdateRequirementsConfirm, setShowUpdateRequirementsConfirm] =
    useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const CHAT_STORAGE_KEY = `ai-bubble-chat-${projectId}`;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(`ai-bubble-chat-${projectId}`)
          : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const setChatMessagesAndSave = (
    updater: (prev: ChatMessage[]) => ChatMessage[],
  ) => {
    setChatMessages((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(
          `ai-bubble-chat-${projectId}`,
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  };
  const [chatInput, setChatInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [activeAiJob, setActiveAiJob] = useState<{ jobId: string; type: string } | null>(null);
  const activeAiJobRef = useRef(activeAiJob);
  useEffect(() => {
    activeAiJobRef.current = activeAiJob;
  }, [activeAiJob]);
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
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [newSprintName, setNewSprintName] = useState("");
  const [newEpicName, setNewEpicName] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [generatedTaskPrompt, setGeneratedTaskPrompt] = useState("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [descriptionAiMessages, setDescriptionAiMessages] = useState<
    DescriptionAiMessage[]
  >([]);
  const [activityTab, setActivityTab] = useState<ActivityTab>("comments");
  const [commentDraft, setCommentDraft] = useState("");
  const [workLogDraft, setWorkLogDraft] = useState("");
  const [workLogNote, setWorkLogNote] = useState("");
  const [taskNamingRuleDraft, setTaskNamingRuleDraft] = useState("");
  const [showLabelFilterMenu, setShowLabelFilterMenu] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [taskFilters, setTaskFilters] = useState({
    search: "",
    status: "",
    priority: "",
    epic: "",
    labels: [] as string[],
    sprint: "",
    assigneeId: "",
    dueFrom: "",
    dueTo: "",
    ai: "",
  });
  const [sprints, setSprints] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`sprints-${projectId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const websocketCallbacks = useMemo(() => ({
    onAiJobCompleted: (data: any) => {
      if (activeAiJobRef.current && data.jobId === activeAiJobRef.current.jobId) {
        if (data.type === "updateRequirements") {
          toast.success("AI update completed successfully!");
        }
        setActiveAiJob(null);
      }
    },
    onAiJobFailed: (data: any) => {
      if (activeAiJobRef.current && data.jobId === activeAiJobRef.current.jobId) {
        toast.error(data.error || "AI job failed");
        setActiveAiJob(null);
      }
    },
  }), []);

  useProjectWebsocket(projectId, websocketCallbacks);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getOne(projectId).then((r) => r.data),
  });

  // Separate paginated tasks query — decoupled from project metadata
  const [taskParams, setTaskParams] = useState({ skip: 0, take: 100 });
  const { data: tasksPage, isLoading: tasksLoading } = useQuery({
    queryKey: ["project-tasks", projectId, taskParams],
    queryFn: () => tasksApi.getAll(projectId, taskParams).then((r) => r.data),
  });
  const tasks = tasksPage?.data ?? [];

  // Separate paginated documents query
  const [docParams, setDocParams] = useState({ skip: 0, take: 50 });
  const { data: docsPage, isLoading: docsLoading } = useQuery({
    queryKey: ["project-documents", projectId, docParams],
    queryFn: () => documentsApi.getAll(projectId, docParams).then((r) => r.data),
  });
  const documents = docsPage?.data ?? [];

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll().then((r) => r.data),
    enabled: hasPermission("user:read"), // Only fetch system users if user has permission
  });
  const { data: requirements, refetch: refetchReq } = useQuery({
    queryKey: ["requirements", projectId],
    queryFn: () => aiApi.getRequirements(projectId).then((r) => r.data),
    enabled: tab === "documents" && docSubTab === "requirements",
  });
  const { data: reqHistory = [] } = useQuery({
    queryKey: ["req-history", projectId],
    queryFn: () => aiApi.getHistory(projectId).then((r) => r.data),
    enabled: tab === "documents" && docSubTab === "requirements" && showHistory,
  });
  const { data: taskActivities = [], isLoading: loadingTaskActivities } =
    useQuery<TaskActivity[]>({
      queryKey: ["task-activities", projectId, editTask?.id],
      queryFn: () =>
        tasksApi.getActivities(projectId, editTask.id).then((r) => r.data),
      enabled: showTaskModal && !!editTask?.id,
    });

  useEffect(() => {
    setTaskNamingRuleDraft(project?.taskNamingRule || "");
  }, [project?.taskNamingRule]);

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
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      toast.success("Task created");
      setShowTaskModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: any) =>
      tasksApi.update(projectId, taskId, data),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({
        queryKey: ["task-activities", projectId, response?.data?.id],
      });
      if (response?.data) {
        setEditTask(response.data);
        const t = response.data;
        // Synchronize editor HTML display state with the updated database value
        setDescriptionHtml(t.description || "");
        reset({
          title: t.title,
          description: t.description || "",
          priority: t.priority,
          status: t.status,
          assigneeId: t.assignee?.id || "",
          dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
          epic: t.epic || "",
          labels: t.labels || [],
          sprint: t.sprint || "",
          estimateInput: toHours(t.estimateHours)
            ? formatDuration(t.estimateHours)
            : "",
          loggedInput: toHours(t.loggedHours) ? formatDuration(t.loggedHours) : "",
        });
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: any) =>
      tasksApi.updateStatus(projectId, taskId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
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

  const updateProjectMetadataMutation = useMutation({
    mutationFn: (data: {
      epics?: string[];
      labels?: string[];
      taskNamingRule?: string;
    }) => projectsApi.update(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Project fields updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      toast.success("Task deleted");
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => documentsApi.delete(projectId, docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Document deleted");
    },
  });

  const updateReqMutation = useMutation({
    mutationFn: () => aiApi.updateRequirements(projectId).then((r) => r.data),
    onSuccess: (data) => {
      setActiveAiJob({ jobId: data.jobId, type: "updateRequirements" });
      toast.info("AI update job queued. Processing in background...");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to update requirements"),
  });

  const improveDescriptionMutation = useMutation({
    mutationFn: (payload: { title?: string; description: string }) =>
      aiApi.improveDescription(projectId, payload).then((r) => r.data),
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to improve description"),
  });

  const assistDescriptionMutation = useMutation({
    mutationFn: (payload: {
      title?: string;
      description: string;
      instruction: string;
    }) => aiApi.assistDescription(projectId, payload).then((r) => r.data),
    onError: (e: any) =>
      toast.error(
        e.response?.data?.message || "Failed to apply AI instruction",
      ),
  });

  const addTaskCommentMutation = useMutation({
    mutationFn: (body: string) =>
      tasksApi.addComment(projectId, editTask.id, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["task-activities", projectId, editTask?.id],
      });
      setCommentDraft("");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to add comment"),
  });

  const addTaskWorkLogMutation = useMutation({
    mutationFn: (data: { durationHours: number; note?: string }) =>
      tasksApi.addWorkLog(projectId, editTask.id, data).then((r) => r.data),
    onSuccess: (_activity, variables) => {
      const currentLogged =
        parseDurationInput(getValues("loggedInput")) ?? toHours(editTask?.loggedHours);
      const nextLogged = currentLogged + variables.durationHours;
      setValue("loggedInput", formatDuration(nextLogged), { shouldDirty: true });
      if (editTask) {
        setEditTask({ ...editTask, loggedHours: nextLogged });
      }
      qc.invalidateQueries({
        queryKey: ["task-activities", projectId, editTask?.id],
      });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setWorkLogDraft("");
      setWorkLogNote("");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to add work log"),
  });

  const [chatLoading, setChatLoading] = useState(false);
  const chatMutation = { isPending: chatLoading };

  const confirmReviewMutation = useMutation({
    mutationFn: (tasks: SuggestedTask[]) =>
      aiApi.confirmTasks(projectId, tasks).then((r) => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setReviewTasks(null);
      setChatMessagesAndSave((prev) =>
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

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatLoading(true);

    const userMessage: ChatMessage = { role: "user", content: msg };
    const assistantPlaceholder: ChatMessage = { role: "assistant", content: "", agentLogs: [] };

    const newMessages = [...chatMessages, userMessage];
    setChatMessagesAndSave(() => [...newMessages, assistantPlaceholder]);

    let assistantContent = "";
    let suggestedTasksLocal: SuggestedTask[] = [];
    let assistantLogsLocal: any[] = [];
    const language = (typeof window !== "undefined" ? localStorage.getItem("nexusai_chat_lang") : null) || "vi";

    try {
      await aiApi.chatStream(
        projectId,
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        undefined,
        (chunk) => {
          assistantContent += chunk;
          setChatMessages((prev) => {
            const next = [...prev];
            if (next.length > 0 && next[next.length - 1].role === "assistant") {
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: assistantContent,
              };
            }
            return next;
          });
        },
        (tasks) => {
          suggestedTasksLocal = tasks;
        },
        async () => {
          setChatMessagesAndSave((prev) => {
            const next = [...prev];
            if (next.length > 0 && next[next.length - 1].role === "assistant") {
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: assistantContent,
                suggestedTasks: suggestedTasksLocal.length ? suggestedTasksLocal : undefined,
                agentLogs: assistantLogsLocal.length ? assistantLogsLocal : undefined,
              };
            }
            return next;
          });

          if (suggestedTasksLocal.length > 0) {
            setReviewTasks(suggestedTasksLocal);
          }

          setChatLoading(false);
        },
        (error) => {
          console.error("Stream error", error);
          toast.error(error.message || "Stream connection lost");
          if (!assistantContent) {
            setChatMessagesAndSave((prev) => prev.slice(0, -1));
          }
          setChatLoading(false);
        },
        (log) => {
          assistantLogsLocal.push(log);
          setChatMessages((prev) => {
            const next = [...prev];
            if (next.length > 0 && next[next.length - 1].role === "assistant") {
              next[next.length - 1] = {
                ...next[next.length - 1],
                agentLogs: [...assistantLogsLocal],
              };
            }
            return next;
          });
        },
        language
      );
    } catch (e: any) {
      console.error("Failed to initiate stream", e);
      toast.error(e.message || "Failed to initiate stream");
      setChatLoading(false);
    }
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

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { isDirty },
  } = useForm<any>();
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
  const allEpics = project?.epics ?? [];
  const allLabels = project?.labels ?? [];
  const currentMember = project?.members?.find(
    (member: any) => member.userId === user?.id,
  );
  const currentProjectPermissions = Array.from(
    new Set([
      ...((currentMember?.projectRole
        ? getProjectRolePermissions(
            projectRoleConfigs,
            currentMember.projectRole,
          )
        : []) || []),
      ...(user?.role?.permissions || []),
    ]),
  );
  const canProject = (permission: string) =>
    hasPermission(permission) || currentProjectPermissions.includes(permission);

  const saveSprints = (updated: string[]) => {
    setSprints(updated);
    localStorage.setItem(`sprints-${projectId}`, JSON.stringify(updated));
  };

  // Merge sprints from tasks into the managed list (once project loads)
  const allSprints = Array.from(
    new Set([
      ...sprints,
      ...(project?.tasks?.map((t: any) => t.sprint).filter(Boolean) ?? []),
    ]),
  ).sort();

  const filteredTasks = (tasks || []).filter((task: any) => {
    const search = taskFilters.search.trim().toLowerCase();
    if (
      search &&
      !`${task.title || ""} ${task.description || ""}`
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }

    if (taskFilters.status && task.status !== taskFilters.status) return false;
    if (taskFilters.priority && task.priority !== taskFilters.priority)
      return false;
    if (taskFilters.epic && (task.epic || "") !== taskFilters.epic)
      return false;
    if (taskFilters.sprint && (task.sprint || "") !== taskFilters.sprint)
      return false;
    if (
      taskFilters.assigneeId &&
      String(task.assignee?.id || "") !== taskFilters.assigneeId
    ) {
      return false;
    }
    if (
      taskFilters.labels.length > 0 &&
      !taskFilters.labels.every((label) => task.labels?.includes(label))
    ) {
      return false;
    }
    if (taskFilters.dueFrom) {
      if (!task.dueDate || task.dueDate.slice(0, 10) < taskFilters.dueFrom)
        return false;
    }
    if (taskFilters.dueTo) {
      if (!task.dueDate || task.dueDate.slice(0, 10) > taskFilters.dueTo)
        return false;
    }
    if (taskFilters.ai === "ai" && !task.isAiGenerated) return false;
    if (taskFilters.ai === "manual" && task.isAiGenerated) return false;

    return true;
  });
  const hasTaskFilters =
    taskFilters.search ||
    taskFilters.status ||
    taskFilters.priority ||
    taskFilters.epic ||
    taskFilters.labels.length > 0 ||
    taskFilters.sprint ||
    taskFilters.assigneeId ||
    taskFilters.dueFrom ||
    taskFilters.dueTo ||
    taskFilters.ai;
  const showTaskFilters = [
    "summary",
    "timeline",
    "backlog",
    "board",
    "calendar",
  ].includes(tab);



  const totalEstimateHours =
    filteredTasks.reduce(
      (total: number, task: any) => total + toHours(task.estimateHours),
      0,
    ) || 0;
  const totalLoggedHours =
    filteredTasks.reduce(
      (total: number, task: any) => total + toHours(task.loggedHours),
      0,
    ) || 0;

  const updateReviewTaskDuration = (
    index: number,
    field: "estimateHours" | "loggedHours",
    part: "days" | "hours" | "minutes",
    value: string,
  ) => {
    setReviewTasks((prev) =>
      prev!.map((task, taskIndex) => {
        if (taskIndex !== index) return task;

        const duration = durationFromHours(task[field]);
        const nextDuration = {
          ...duration,
          [part]: value ? Number(value) : 0,
        };

        return {
          ...task,
          [field]: durationToHours(
            nextDuration.days,
            nextDuration.hours,
            nextDuration.minutes,
          ),
        };
      }),
    );
  };

  const tabs = [
    { key: "summary", label: "Summary", icon: BarChart2 },
    { key: "timeline", label: "Timeline", icon: GitBranch },
    { key: "backlog", label: "Backlog", icon: ListChecks },
    { key: "board", label: "Board", icon: LayoutGrid },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
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
      epic: "",
      labels: [],
      sprint: "",
      estimateInput: "",
      loggedInput: "",
    });
    setDescriptionHtml("");
    setDescriptionAiMessages([]);
    setGeneratedTaskPrompt("");
    setGeneratingPrompt(false);
    setActivityTab("comments");
    setCommentDraft("");
    setWorkLogDraft("");
    setWorkLogNote("");
    setEditTask(null);
    setShowTaskModal(true);
  };

  const openEditTask = (t: any) => {
    const initialDescription = t.description || "";
    reset({
      title: t.title,
      description: initialDescription,
      priority: t.priority,
      status: t.status,
      assigneeId: t.assignee?.id || "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
      epic: t.epic || "",
      labels: t.labels || [],
      sprint: t.sprint || "",
      estimateInput: toHours(t.estimateHours)
        ? formatDuration(t.estimateHours)
        : "",
      loggedInput: toHours(t.loggedHours) ? formatDuration(t.loggedHours) : "",
    });
    setDescriptionHtml(initialDescription);
    setDescriptionAiMessages([]);
    setGeneratedTaskPrompt(t.agentPrompt || "");
    setGeneratingPrompt(false);
    setActivityTab("comments");
    setCommentDraft("");
    setWorkLogDraft("");
    setWorkLogNote("");
    setEditTask(t);
    setShowTaskModal(true);
  };

  const onTaskSubmit = (data: any) => {
    const { estimateInput, loggedInput, ...taskData } = data;
    const estimateHours = parseDurationInput(estimateInput);
    const loggedHours = parseDurationInput(loggedInput);

    if (estimateHours == null || loggedHours == null) {
      toast.error('Use time like "30m", "1h", "1d" or "1d 2h 30m"');
      return;
    }

    const payload = {
      ...taskData,
      description: sanitizeRichTextHtml(data.description || ""),
      assigneeId: data.assigneeId ? Number(data.assigneeId) : undefined,
      dueDate: data.dueDate || undefined,
      epic: data.epic?.trim() || undefined,
      labels: parseTaskLabels(data.labels),
      sprint: data.sprint?.trim() || undefined,
      estimateHours,
      loggedHours,
      status: data.status || undefined,
    };
    if (editTask)
      updateTaskMutation.mutate({ taskId: editTask.id, data: payload });
    else createTaskMutation.mutate(payload);
  };

  const autoSaveTask = () => {
    if (!editTask || updateTaskMutation.isPending || !isDirty) return;
    onTaskSubmit(getValues());
  };

  const selectedTaskLabels = parseTaskLabels(watch("labels"));
  const watchedEstimateInput = watch("estimateInput");
  const watchedLoggedInput = watch("loggedInput");

  const addTaskComment = () => {
    const body = commentDraft.trim();
    if (!editTask) {
      toast.error("Create the task before adding comments");
      return;
    }
    if (isHtmlEmpty(body) || addTaskCommentMutation.isPending) return;
    addTaskCommentMutation.mutate(body);
  };

  const addTaskWorkLog = () => {
    if (!editTask) {
      toast.error("Create the task before logging work");
      return;
    }

    const durationHours = parseDurationInput(workLogDraft);
    if (!durationHours) {
      toast.error('Use time like "30m", "1h", "1d" or "1d 2h 30m"');
      return;
    }

    addTaskWorkLogMutation.mutate({
      durationHours,
      note: workLogNote.trim() || undefined,
    });
  };

  const filteredTaskActivities = taskActivities.filter((activity) => {
    if (activityTab === "all") return true;
    if (activityTab === "comments") return activity.type === "COMMENT";
    if (activityTab === "history") return activity.type === "HISTORY";
    return activity.type === "WORK_LOG";
  });

  const describeActivity = (activity: TaskActivity) => {
    if (activity.type === "COMMENT") return activity.body || "";
    if (activity.type === "WORK_LOG") {
      const duration = formatDuration(activity.durationHours || 0);
      return activity.body ? `Logged ${duration}: ${activity.body}` : `Logged ${duration}`;
    }
    if (activity.body) return activity.body;
    if (activity.field) {
      const from = activity.fromValue || "None";
      const to = activity.toValue || "None";
      return `Changed ${activity.field} from ${from} to ${to}`;
    }
    return "Updated task";
  };

  const toggleTaskLabel = (label: string) => {
    const current = parseTaskLabels(getValues("labels"));
    const next = current.includes(label)
      ? current.filter((value) => value !== label)
      : [...current, label];

    setValue("labels", next, { shouldDirty: true });
    if (editTask && !updateTaskMutation.isPending) {
      onTaskSubmit({ ...getValues(), labels: next });
    }
  };

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
    setValue("description", improved, { shouldDirty: true });
    setDescriptionAiMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Đã cải thiện description." },
    ]);
    if (editTask && !updateTaskMutation.isPending) {
      onTaskSubmit({ ...getValues(), description: improved });
    }
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
        taskId: editTask?.id || undefined,
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
    setValue("description", next, { shouldDirty: true });
    setDescriptionAiMessages((prev) => [
      ...prev,
      { role: "assistant", content: result?.message || "Updated." },
    ]);

    if (editTask && !updateTaskMutation.isPending) {
      onTaskSubmit({ ...getValues(), description: next });
    }
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

  const saveProjectEpics = (epics: string[]) => {
    updateProjectMetadataMutation.mutate({ epics: parseTaskLabels(epics) });
  };

  const saveProjectLabels = (labels: string[]) => {
    updateProjectMetadataMutation.mutate({ labels: parseTaskLabels(labels) });
  };

  const saveTaskNamingRule = () => {
    updateProjectMetadataMutation.mutate({
      taskNamingRule: taskNamingRuleDraft.trim(),
    });
  };

  const clearTaskFilters = () =>
    setTaskFilters({
      search: "",
      status: "",
      priority: "",
      epic: "",
      labels: [],
      sprint: "",
      assigneeId: "",
      dueFrom: "",
      dueTo: "",
      ai: "",
    });

  const uploadDocumentFile = async (file: File) => {
    try {
      setUploading(true);
      await documentsApi.upload(projectId, file);
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Upload successful");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setPendingUploadFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUploadFile(file);
  };

  const cancelFileUpload = () => {
    setPendingUploadFile(null);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const memberIds = new Set<number>(project?.members?.map((m: any) => m.userId) || []);

  if (isLoading)
    return (
      <div className='py-12 flex justify-center'>
        <Loader2 className='animate-spin text-blue-500' />
      </div>
    );
  if (!project)
    return (
      <div className='text-center py-12 text-zinc-500 dark:text-zinc-400'>Project not found</div>
    );
  if (!canProject("project:read")) {
    return <AccessDenied />;
  }

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
  };

  return (
    <div className="space-y-3 max-w-[1400px] mx-auto select-none">
      <ProjectHeader
        project={project}
        totalTasks={tasksPage?.total ?? tasks.length}
        doneTasks={tasks.filter((t: any) => t.status === "DONE").length}
        totalDocs={docsPage?.total ?? documents.length}
        canDelete={canProject("project:delete")}
        canCreateTask={canProject("task:create")}
        onDeleteProject={() => confirm("Delete this project?") && deleteProjectMutation.mutate()}
        onAddTask={openCreateTask}
      />

      {/* Sticky Container for Navigation and Filters */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl py-2 space-y-2 border-b border-white/5 -mx-6 px-6">
        {/* Modern Segmented Navigation Tabs */}
        <div className="bg-zinc-950/40 border border-white/5 p-0.5 rounded-lg flex overflow-x-auto hide-scrollbar max-w-max h-8">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold transition-all relative whitespace-nowrap rounded-md group",
                tab === key
                  ? "text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {tab === key && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white/5 border border-white/10 rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={12} className={cn("relative z-10 transition-colors", tab === key ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300")} /> 
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        {showTaskFilters && (
          <TaskFilters
            filters={taskFilters}
            setFilters={setTaskFilters}
            workflowStatuses={workflowStatuses}
            allEpics={allEpics}
            allLabels={allLabels}
            allSprints={allSprints}
            members={project.members || []}
            clearFilters={clearTaskFilters}
            hasFilters={!!hasTaskFilters}
            filteredCount={filteredTasks.length}
            totalCount={(tasksPage?.total ?? tasks.length) || 0}
          />
        )}
      </div>

      {/* Backlog Tab */}
      {tab === "backlog" && (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <p className="text-center text-zinc-400 dark:text-zinc-500 py-8 text-xs">
              {hasTaskFilters ? "No tasks match these filters" : "No tasks yet"}
            </p>
          ) : (
            <TaskLinearList
              tasks={filteredTasks}
              projectWorkflow={projectWorkflow}
              onEditTask={openEditTask}
              onDeleteTask={(id) => deleteTaskMutation.mutate(id)}
              onStatusChange={(taskId, status) => updateStatusMutation.mutate({ taskId, status })}
              canUpdateTask={canProject("task:update")}
              canDeleteTask={canProject("task:delete")}
              onAiAssist={(t) => {
                openEditTask(t);
              }}
              getAllowedTransitionStatuses={getAllowedTransitionStatuses}
              allSprints={allSprints}
              sprintFilter={taskFilters.sprint}
              onSprintFilterChange={(sprint) => setTaskFilters((prev) => ({ ...prev, sprint }))}
              onManageSprints={() => setShowSprintModal(true)}
              canCreateTask={canProject("task:create")}
              onAddTask={openCreateTask}
            />
          )}
        </div>
      )}

      {/* Summary Tab */}
      {tab === "summary" && (
        <div className='space-y-4'>
          <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3'>
            {[
              { label: "Tổng tasks", value: filteredTasks.length },
              { label: "Thành viên", value: project.members?.length || 0 },
              { label: "Estimate", value: formatDuration(totalEstimateHours) },
              { label: "Logged", value: formatDuration(totalLoggedHours) },
              {
                label: "Tài liệu",
                value:
                  documents?.filter(
                    (d: any) =>
                      d.originalName !== "requirements.md" &&
                      !d.mimeType?.startsWith("image/"),
                  ).length || 0,
              },
              {
                label: "Hoàn thành",
                value:
                  filteredTasks.filter(
                    (t: any) =>
                      t.status ===
                      workflowStatuses[workflowStatuses.length - 1],
                  ).length || 0,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-4'
              >
                <p className='text-xs text-zinc-500 dark:text-zinc-400'>{stat.label}</p>
                <p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1'>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-5'>
            <h3 className='text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3'>
              Tasks theo trạng thái
            </h3>
            <div className='space-y-2'>
              {workflowStatuses.map((status: string) => {
                const count =
                  filteredTasks.filter((t: any) => t.status === status)
                    .length || 0;
                const total = filteredTasks.length || 1;
                return (
                  <div key={status} className='flex items-center gap-3'>
                    <span
                      className='text-xs px-2 py-0.5 rounded-full font-medium border w-28 text-center truncate flex-shrink-0'
                      style={getTaskStatusInlineStyle(status, projectWorkflow)}
                    >
                      {status}
                    </span>
                    <div className='flex-1 bg-gray-100 rounded-full h-2'>
                      <div
                        className='h-2 rounded-full bg-blue-500 transition-all'
                        style={{
                          width: `${total > 0 ? (count / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className='text-xs text-zinc-500 dark:text-zinc-400 w-6 text-right'>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-5'>
            <h3 className='text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3'>
              Tasks gần đây
            </h3>
            {filteredTasks.length === 0 ? (
              <p className='text-sm text-zinc-400 dark:text-zinc-500 text-center py-4'>
                Chưa có task nào
              </p>
            ) : (
              <div className='divide-y divide-gray-50'>
                {filteredTasks.slice(0, 6).map((t: any) => (
                  <div
                    key={t.id}
                    className='flex items-center gap-3 py-2.5 cursor-pointer hover:bg-zinc-50 dark:bg-white/5 rounded-lg px-1 -mx-1'
                    onClick={() => openEditTask(t)}
                  >
                    <span
                      className='text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0'
                      style={getTaskStatusInlineStyle(
                        t.status,
                        projectWorkflow,
                      )}
                    >
                      {t.status}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm text-gray-800 truncate dark:text-zinc-200'>
                        {t.title}
                      </p>
                      <p className='text-[11px] font-semibold text-zinc-400 dark:text-zinc-500'>
                        {t.id}
                      </p>
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
                    <span className='text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0'>
                      {formatDuration(t.loggedHours)} /{" "}
                      {formatDuration(t.estimateHours)}
                    </span>
                    <span className='text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0'>
                      {t.assignee?.name || "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Board Tab */}
      {tab === "board" && (
        <ProjectBoard
          workflowStatuses={workflowStatuses}
          filteredTasks={filteredTasks}
          dragOverStatus={dragOverStatus}
          setDragOverStatus={setDragOverStatus}
          dragTaskId={dragTaskId}
          setDragTaskId={setDragTaskId}
          tasks={tasks || []}
          canProject={canProject}
          updateStatusMutation={updateStatusMutation}
          projectWorkflow={projectWorkflow}
          openEditTask={openEditTask}
          openCreateTask={openCreateTask}
          isLoading={tasksLoading}
        />
      )}

      {/* Timeline Tab */}
      {tab === "timeline" && (
        <div className='space-y-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <button
              onClick={() => setShowSprintModal(true)}
              className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 px-3 py-1.5 rounded-lg hover:bg-zinc-50 dark:bg-white/5'
            >
              <GitBranch size={14} /> Manage Sprints
              {allSprints.length > 0 && (
                <span className='bg-gray-100 text-zinc-600 dark:text-zinc-400 text-xs px-1.5 py-0.5 rounded-full'>
                  {allSprints.length}
                </span>
              )}
            </button>
          </div>
          {!filteredTasks.length ? (
            <p className='text-center text-zinc-400 dark:text-zinc-500 py-8'>
              {hasTaskFilters
                ? "No tasks match these filters"
                : "Chưa có task nào"}
            </p>
          ) : (
            (() => {
              const sprintGroups = Array.from(
                new Set(filteredTasks.map((t: any) => t.sprint || "")),
              ).sort() as string[];
              const groups = [
                ...sprintGroups.filter((s) => s !== ""),
                ...(filteredTasks.some((t: any) => !t.sprint) ? [""] : []),
              ];
              return groups.map((sprint) => {
                const tasks = filteredTasks.filter((t: any) =>
                  sprint === "" ? !t.sprint : t.sprint === sprint,
                );
                return (
                  <div
                    key={sprint || "__nosprint"}
                    className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden'
                  >
                    <div className='px-4 py-3 bg-zinc-50 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5 flex items-center gap-2'>
                      <GitBranch size={14} className='text-zinc-400 dark:text-zinc-500' />
                      <span className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
                        {sprint || "Chưa có sprint"}
                      </span>
                      <span className='text-xs text-zinc-400 dark:text-zinc-500 ml-1'>
                        {tasks.length} tasks
                      </span>
                    </div>
                    <div className='divide-y divide-gray-50'>
                      {tasks.map((t: any) => (
                        <div
                          key={t.id}
                          className='px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-50 dark:bg-white/5 cursor-pointer'
                          onClick={() => openEditTask(t)}
                        >
                          <span
                            className='text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0'
                            style={getTaskStatusInlineStyle(
                              t.status,
                              projectWorkflow,
                            )}
                          >
                            {t.status}
                          </span>
                          <p className='flex-1 text-sm text-gray-800 truncate dark:text-zinc-200'>
                            {t.title}
                          </p>
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
                          <span className='text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0'>
                            {formatDuration(t.loggedHours)} /{" "}
                            {formatDuration(t.estimateHours)}
                          </span>
                          {t.dueDate && (
                            <span className='text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0'>
                              {formatDate(t.dueDate)}
                            </span>
                          )}
                          {t.assignee && (
                            <span className='text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0'>
                              {t.assignee.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      )}

      {/* Calendar Tab */}
      {tab === "calendar" && (
        <div className='space-y-3'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() =>
                setCalendarDate(
                  (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1),
                )
              }
              className='p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400'
            >
              <ChevronLeft size={16} />
            </button>
            <h3 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex-1 text-center capitalize'>
              {calendarDate.toLocaleString("vi-VN", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              onClick={() =>
                setCalendarDate(
                  (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
                )
              }
              className='p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400'
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {(() => {
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth();
            const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const cells = Array.from(
              { length: firstDayOfWeek + daysInMonth },
              (_, i) => (i < firstDayOfWeek ? null : i - firstDayOfWeek + 1),
            );
            const tasksByDay: Record<string, any[]> = {};
            filteredTasks.forEach((t: any) => {
              if (!t.dueDate) return;
              const key = t.dueDate.slice(0, 10);
              if (!tasksByDay[key]) tasksByDay[key] = [];
              tasksByDay[key].push(t);
            });
            const today = new Date();
            return (
              <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden'>
                <div className='grid grid-cols-7 border-b border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5'>
                  {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                    <div
                      key={d}
                      className='py-2 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500'
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className='grid grid-cols-7'>
                  {cells.map((day, idx) => {
                    if (!day)
                      return (
                        <div
                          key={`empty-${idx}`}
                          className='min-h-[80px] border-r border-b border-gray-50 bg-zinc-50 dark:bg-white/5/50'
                        />
                      );
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const tasks = tasksByDay[dateStr] || [];
                    const isToday =
                      today.getFullYear() === year &&
                      today.getMonth() === month &&
                      today.getDate() === day;
                    return (
                      <div
                        key={idx}
                        className='min-h-[80px] p-1.5 border-r border-b border-gray-50 hover:bg-zinc-50 dark:bg-white/5/80'
                      >
                        <div
                          className={cn(
                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ml-auto",
                            isToday
                              ? "bg-blue-600 text-white"
                              : "text-zinc-600 dark:text-zinc-400",
                          )}
                        >
                          {day}
                        </div>
                        <div className='space-y-0.5'>
                          {tasks.slice(0, 2).map((t: any) => (
                            <div
                              key={t.id}
                              className='text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80'
                              style={getTaskStatusInlineStyle(
                                t.status,
                                projectWorkflow,
                              )}
                              onClick={() => openEditTask(t)}
                            >
                              {t.title}
                            </div>
                          ))}
                          {tasks.length > 2 && (
                            <div className='text-[10px] text-zinc-400 dark:text-zinc-500 px-1'>
                              +{tasks.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Documents Tab */}
      {tab === "documents" && (
        <ProjectDocuments
          projectId={projectId}
          requirements={requirements}
          documents={documents}
          uploading={uploading}
          docSubTab={docSubTab}
          setDocSubTab={setDocSubTab}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          reqHistory={reqHistory}
          previewVersion={previewVersion}
          setPreviewVersion={setPreviewVersion}
          setShowUpdateRequirementsConfirm={setShowUpdateRequirementsConfirm}
          updateReqMutation={{
            ...updateReqMutation,
            isPending: updateReqMutation.isPending || activeAiJob?.type === "updateRequirements",
          }}
          canProject={canProject}
          handleFileUpload={handleFileUpload}
          deleteProjectDocument={deleteDocMutation.mutate}
          uploadInputRef={uploadInputRef}
        />
      )}

      {tab === "settings" && canProject("project:update") && (
        <div className='space-y-4'>
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='max-w-2xl space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500'>
                Project Settings
              </p>
              <div>
                <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>
                  Project task workflow
                </h2>
                <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
                  The workflow has been moved out of the task screen. Only
                  members with project settings access can view and edit it.
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

          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='max-w-2xl space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500'>
                Task Fields
              </p>
              <div>
                <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>
                  Epics, labels, and naming rule
                </h2>
                <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
                  Manage the dropdown values used by tasks and the title format
                  applied when tasks are created or updated.
                </p>
              </div>
              <div className='flex flex-wrap gap-2 pt-1'>
                {allEpics.map((epic: string) => (
                  <span
                    key={epic}
                    className='rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600'
                  >
                    {epic}
                  </span>
                ))}
                {allLabels.map((label: string) => (
                  <span
                    key={label}
                    className='rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowTaxonomyModal(true)}
              className='px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2'
            >
              <Tags size={14} /> Edit fields
            </button>
          </div>

          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-zinc-200 dark:border-white/5 overflow-hidden'>
            <div className='px-5 py-4 border-b border-zinc-200 dark:border-white/5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500'>
                  Workflow Canvas
                </p>
                <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
                  Drag statuses, connect transitions, and color each node in the
                  builder.
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
        <ProjectMembers
          project={project}
          users={users}
          projectRoles={projectRoles}
          memberIds={memberIds}
          addMemberDialog={addMemberDialog}
          setAddMemberDialog={setAddMemberDialog}
          addMemberRole={addMemberRole}
          setAddMemberRole={setAddMemberRole}
          editingRole={editingRole}
          setEditingRole={setEditingRole}
          canProject={canProject}
          openRolesEditor={openRolesEditor}
          addMemberMutation={addMemberMutation}
          updateMemberRoleMutation={updateMemberRoleMutation}
          removeMemberMutation={removeMemberMutation}
        />
      )}

      {/* Task Modal */}
      {/* AI Task Review Modal */}
      {reviewTasks && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 md:p-6'>
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/5 flex-shrink-0'>
              <div className='flex items-center gap-2'>
                <BrandLogo size={24} />
                <div>
                  <div className='flex items-center gap-2'>
                    <span className='font-semibold text-zinc-900 dark:text-zinc-100'>
                      Review suggested tasks
                    </span>
                    <span className='text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-semibold'>
                      {reviewTasks.length} tasks
                    </span>
                  </div>
                  <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-1'>
                    AI generated a draft task list. Review and edit it here
                    before creating tasks.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewTasks(null)}
                className='text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:text-zinc-300'
              >
                <X size={18} />
              </button>
            </div>

            <div className='flex-1 overflow-y-auto p-5 md:p-6 space-y-4 bg-zinc-50 dark:bg-white/5/60'>
              {reviewTasks.map((task, idx) => (
                <div
                  key={idx}
                  className='border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl p-4 md:p-5 space-y-4 shadow-sm'
                >
                  <div className='flex items-start gap-2'>
                    <span className='text-xs font-bold text-zinc-400 dark:text-zinc-500 mt-2 w-5 flex-shrink-0'>
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
                      className='flex-1 text-sm font-semibold border-0 border-b border-zinc-200 dark:border-white/10 focus:outline-none focus:border-sky-400 py-1'
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
                    className='w-full text-xs border border-zinc-200 dark:border-white/5 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-sky-300 text-zinc-600 dark:text-zinc-400 ml-7'
                    placeholder='Task description...'
                  />

                  <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3 ml-7'>
                    <div>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Priority</p>
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
                        className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='HIGH'>HIGH</option>
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='MEDIUM'>MEDIUM</option>
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='LOW'>LOW</option>
                      </select>
                    </div>
                    <div>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Deadline</p>
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
                        className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                      />
                    </div>
                    <div>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Epic</p>
                      <select
                        value={task.epic || ""}
                        onChange={(e) =>
                          setReviewTasks((prev) =>
                            prev!.map((t, i) =>
                              i === idx
                                ? { ...t, epic: e.target.value || undefined }
                                : t,
                            ),
                          )
                        }
                        className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>- No epic -</option>
                        {allEpics.map((epic: string) => (
                          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={epic} value={epic}>
                            {epic}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Labels</p>
                      <div className='flex min-h-[38px] flex-wrap gap-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl p-1.5'>
                        {allLabels.length === 0 ? (
                          <span className='px-1 text-xs text-zinc-400 dark:text-zinc-500'>
                            No labels
                          </span>
                        ) : (
                          allLabels.map((label: string) => {
                            const checked = task.labels?.includes(label);
                            return (
                              <button
                                key={label}
                                type='button'
                                onClick={() =>
                                  setReviewTasks((prev) =>
                                    prev!.map((t, i) => {
                                      if (i !== idx) return t;
                                      const labels = parseTaskLabels(t.labels);
                                      return {
                                        ...t,
                                        labels: checked
                                          ? labels.filter(
                                              (value) => value !== label,
                                            )
                                          : [...labels, label],
                                      };
                                    }),
                                  )
                                }
                                className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                                  checked
                                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                    : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Sprint</p>
                      <select
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
                        className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>- Không có sprint -</option>
                        {allSprints.map((s) => (
                          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='xl:col-span-2'>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Estimate</p>
                      <div className='grid grid-cols-3 gap-1.5'>
                        <input
                          type='number'
                          min='0'
                          placeholder='Days'
                          value={
                            durationFromHours(task.estimateHours).days || ""
                          }
                          onChange={(e) =>
                            updateReviewTaskDuration(
                              idx,
                              "estimateHours",
                              "days",
                              e.target.value,
                            )
                          }
                          className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                        />
                        <input
                          type='number'
                          min='0'
                          max={HOURS_PER_WORK_DAY - 1}
                          placeholder='Hours'
                          value={
                            durationFromHours(task.estimateHours).hours || ""
                          }
                          onChange={(e) =>
                            updateReviewTaskDuration(
                              idx,
                              "estimateHours",
                              "hours",
                              e.target.value,
                            )
                          }
                          className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                        />
                        <input
                          type='number'
                          min='0'
                          max='59'
                          placeholder='Mins'
                          value={
                            durationFromHours(task.estimateHours).minutes || ""
                          }
                          onChange={(e) =>
                            updateReviewTaskDuration(
                              idx,
                              "estimateHours",
                              "minutes",
                              e.target.value,
                            )
                          }
                          className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                        />
                      </div>
                    </div>
                    <div className='xl:col-span-2'>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Logged</p>
                      <div className='grid grid-cols-3 gap-1.5'>
                        <input
                          type='number'
                          min='0'
                          placeholder='Days'
                          value={durationFromHours(task.loggedHours).days || ""}
                          onChange={(e) =>
                            updateReviewTaskDuration(
                              idx,
                              "loggedHours",
                              "days",
                              e.target.value,
                            )
                          }
                          className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                        />
                        <input
                          type='number'
                          min='0'
                          max={HOURS_PER_WORK_DAY - 1}
                          placeholder='Hours'
                          value={
                            durationFromHours(task.loggedHours).hours || ""
                          }
                          onChange={(e) =>
                            updateReviewTaskDuration(
                              idx,
                              "loggedHours",
                              "hours",
                              e.target.value,
                            )
                          }
                          className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                        />
                        <input
                          type='number'
                          min='0'
                          max='59'
                          placeholder='Mins'
                          value={
                            durationFromHours(task.loggedHours).minutes || ""
                          }
                          onChange={(e) =>
                            updateReviewTaskDuration(
                              idx,
                              "loggedHours",
                              "minutes",
                              e.target.value,
                            )
                          }
                          className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                        />
                      </div>
                    </div>
                    <div>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-1'>Assignee</p>
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
                        className='w-full text-xs border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>- Unassigned</option>
                        {(project?.members || []).map((m: any) => (
                          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={m.userId} value={m.userId}>
                            {m.user?.name || `User ${m.userId}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {reviewTasks.length === 0 && (
                <p className='text-center text-sm text-zinc-400 dark:text-zinc-500 py-8'>
                  All tasks were removed
                </p>
              )}
            </div>

            <div className='flex items-center justify-between px-5 py-4 border-t border-zinc-200 dark:border-white/5 flex-shrink-0 bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-b-3xl'>
              <button
                onClick={() => setReviewTasks(null)}
                className='text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 px-4 py-2'
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
                className='flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-slate-800 disabled:opacity-50'
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
            className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/5'>
              <div className='flex items-center gap-2'>
                <History size={16} className='text-sky-600' />
                <span className='font-semibold text-zinc-900 dark:text-zinc-100 text-sm'>
                  Version v{previewVersion.version}
                </span>
                <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                  | {formatDateTime(previewVersion.createdAt)}
                </span>
              </div>
              <button
                onClick={() => setPreviewVersion(null)}
                className='text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:text-zinc-300'
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
              <pre className='text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed'>
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
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/5'>
              <div>
                <h3 className='font-semibold text-zinc-900 dark:text-zinc-100'>Project roles</h3>
                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                  Create custom project roles and define permissions for each
                  one.
                </p>
              </div>
              <button
                onClick={() => setShowRolesModal(false)}
                className='text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:text-zinc-300'
              >
                <X size={18} />
              </button>
            </div>

            <div className='flex-1 overflow-y-auto p-5 space-y-3'>
              {roleDraft.map((role, index) => (
                <div
                  key={`${role.name}-${index}`}
                  className='border border-zinc-200 dark:border-white/10 rounded-xl p-3 space-y-3'
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
                      className='flex-1 px-3 py-2 border border-zinc-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
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
                        <p className='text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1.5'>
                          {group.label}
                        </p>
                        <div className='flex flex-wrap gap-2'>
                          {group.permissions.map((permission) => {
                            const checked =
                              role.permissions.includes(permission);

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
                                                  (value) =>
                                                    value !== permission,
                                                )
                                              : [
                                                  ...item.permissions,
                                                  permission,
                                                ],
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className={cn(
                                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                                  checked
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white dark:bg-zinc-900/95 backdrop-blur-xl text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-blue-300",
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
                  className='flex-1 px-3 py-2 border border-zinc-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
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

              <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                Each role can enable or disable individual actions in the
                project. If a role is still assigned to members, the backend
                blocks deletion until those members are reassigned.
              </p>
            </div>

            <div className='flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 rounded-b-2xl'>
              <button
                type='button'
                onClick={() => setShowRolesModal(false)}
                className='px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10'
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
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4'>
          <div className='flex w-full max-w-7xl max-h-[92vh] flex-col overflow-hidden rounded-xl bg-white dark:bg-zinc-900/95 backdrop-blur-xl text-zinc-900 dark:text-zinc-100 shadow-2xl'>
            <div className='flex items-center justify-between border-b border-zinc-200 dark:border-white/5 px-6 py-4'>
              <div className='min-w-0'>
                <div className='mb-2 flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400'>
                  <span>Spaces</span>
                  <span>/</span>
                  <span className='truncate'>{project.name}</span>
                  <span>/</span>
                  <span>{editTask ? editTask.id : "NEW-TASK"}</span>
                </div>
                <h3 className='font-semibold text-zinc-900 dark:text-zinc-100'>
                  {editTask ? "Task detail" : "Add new task"}
                </h3>
              </div>
              <button
                type='button'
                onClick={() => {
                  setShowTaskModal(false);
                  setEditTask(null);
                }}
                className='rounded-md p-2 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-700 dark:text-zinc-300'
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={handleSubmit(onTaskSubmit)}
              className='grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]'
            >
              <div className='min-h-0 overflow-y-auto p-6 lg:p-8'>
                <input
                  {...register("title", {
                    required: true,
                    onBlur: autoSaveTask,
                  })}
                  className='w-full bg-transparent text-2xl font-semibold text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400 dark:text-zinc-500 focus:ring-0'
                  placeholder='Task title'
                />
                <div className='mt-8 space-y-8'>
                  <section>
                    <div className='mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                      <ChevronDown size={16} className='text-zinc-400 dark:text-zinc-500' />
                      <span>Key details</span>
                    </div>
                    <div className='grid gap-x-10 gap-y-5 text-sm md:grid-cols-[180px_minmax(0,1fr)]'>
                      <span className='text-zinc-500 dark:text-zinc-400'>Assignee</span>
                      <select
                        {...register("assigneeId", { onBlur: autoSaveTask })}
                        className='max-w-sm rounded-md border border-transparent bg-transparent px-0 py-1 text-sm text-zinc-900 dark:text-zinc-100 hover:border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:bg-white/5 focus:border-blue-300 focus:bg-white dark:bg-zinc-900/95 backdrop-blur-xl focus:outline-none'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Unassigned</option>
                        {project.members?.map((m: any) => (
                          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={m.userId} value={m.userId}>
                            {m.user.name}
                          </option>
                        ))}
                      </select>

                      <span className='text-zinc-500 dark:text-zinc-400'>Due date</span>
                      <input
                        type='date'
                        {...register("dueDate", { onBlur: autoSaveTask })}
                        className='max-w-sm rounded-md border border-transparent bg-transparent px-0 py-1 text-sm text-zinc-900 dark:text-zinc-100 hover:border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:bg-white/5 focus:border-blue-300 focus:bg-white dark:bg-zinc-900/95 backdrop-blur-xl focus:outline-none'
                      />

                      <span className='text-zinc-500 dark:text-zinc-400'>Original estimate</span>
                      <span className='text-zinc-900 dark:text-zinc-100'>
                        {watchedEstimateInput || "None"}
                      </span>

                      <span className='text-zinc-500 dark:text-zinc-400'>Time spent</span>
                      <span className='text-zinc-900 dark:text-zinc-100'>
                        {watchedLoggedInput || "None"}
                      </span>
                    </div>
                  </section>
                  <div>
                    <label className='mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                      Description
                    </label>
                    <input type='hidden' {...register("description")} />
                    <DescriptionEditor
                      projectId={projectId}
                      value={descriptionHtml}
                      onChange={(next) => {
                        setDescriptionHtml(next);
                        setValue("description", next, { shouldDirty: true });
                      }}
                      onBlur={autoSaveTask}
                      onImprove={handleImproveDescription}
                      onAssist={handleAssistDescription}
                      aiMessages={descriptionAiMessages}
                      assisting={assistDescriptionMutation.isPending}
                      improving={improveDescriptionMutation.isPending}
                      mentionItems={
                        project.members?.map((m: any) => ({
                          id: String(m.userId),
                          label: m.user?.name || `User ${m.userId}`,
                        })) || []
                      }
                      disabled={
                        createTaskMutation.isPending ||
                        updateTaskMutation.isPending
                      }
                    />
                  </div>
                  <div className='mt-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-4'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Terminal size={16} className='text-zinc-500 dark:text-zinc-400' />
                        <span className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                          AI Agent Prompt
                        </span>
                      </div>
                      <button
                        type='button'
                        onClick={handleGenerateTaskPrompt}
                        disabled={generatingPrompt || !descriptionHtml}
                        className='inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50'
                      >
                        {generatingPrompt ? (
                          <>
                            <Loader2 size={13} className='animate-spin' />
                            Generating...
                          </>
                        ) : (
                          "Generate Agent Prompt"
                        )}
                      </button>
                    </div>
                    {generatedTaskPrompt && (
                      <div className='mt-3 relative'>
                        <textarea
                          readOnly
                          value={generatedTaskPrompt}
                          className='w-full h-40 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-blue-500'
                        />
                        <button
                          type='button'
                          onClick={() => {
                            navigator.clipboard.writeText(generatedTaskPrompt);
                            toast.success("Prompt copied to clipboard!");
                          }}
                          className='absolute right-2 top-2 rounded-md bg-zinc-100 dark:bg-zinc-800 p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                          title='Copy prompt'
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <section className='space-y-3'>
                    <h4 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                      Subtasks
                    </h4>
                    <button
                      type='button'
                      className='text-sm text-zinc-500 dark:text-zinc-400 hover:text-gray-800'
                    >
                      Add subtask
                    </button>
                  </section>
                  <section className='space-y-3'>
                    <h4 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                      Activity
                    </h4>
                    <div className='flex flex-wrap gap-2'>
                      {[
                        ["all", "All"],
                        ["comments", "Comments"],
                        ["history", "History"],
                        ["worklog", "Work log"],
                      ].map(([key, label]) => (
                          <button
                            key={key}
                            type='button'
                            onClick={() => setActivityTab(key as ActivityTab)}
                            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                              activityTab === key
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                : "border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5"
                            }`}
                          >
                            {label}
                          </button>
                      ))}
                    </div>
                    {editTask ? (
                      <div className='space-y-4'>
                        {(activityTab === "comments" ||
                          activityTab === "all") && (
                          <CommentEditor
                            value={commentDraft}
                            onChange={setCommentDraft}
                            onSubmit={addTaskComment}
                            projectId={projectId}
                            disabled={addTaskCommentMutation.isPending}
                          />
                        )}
                        {(activityTab === "worklog" ||
                          activityTab === "all") && (
                          <div className='rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl p-3'>
                            <div className='grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_auto]'>
                              <input
                                value={workLogDraft}
                                onChange={(event) =>
                                  setWorkLogDraft(event.target.value)
                                }
                                placeholder='1h 30m'
                                className='bg-transparent rounded-md border border-zinc-200 dark:border-white/10 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
                              />
                              <input
                                value={workLogNote}
                                onChange={(event) =>
                                  setWorkLogNote(event.target.value)
                                }
                                placeholder='Work log note'
                                className='bg-transparent rounded-md border border-zinc-200 dark:border-white/10 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
                              />
                              <button
                                type='button'
                                onClick={addTaskWorkLog}
                                disabled={
                                  !workLogDraft.trim() ||
                                  addTaskWorkLogMutation.isPending
                                }
                                className='rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50'
                              >
                                Log work
                              </button>
                            </div>
                          </div>
                        )}
                        <div className='space-y-2'>
                          {loadingTaskActivities ? (
                            <div className='flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400'>
                              <Loader2 size={14} className='animate-spin' />
                              Loading activity...
                            </div>
                          ) : filteredTaskActivities.length === 0 ? (
                            <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                              No activity yet.
                            </p>
                          ) : (
                            filteredTaskActivities.map((activity) => (
                              <div
                                key={activity.id}
                                className='rounded-lg border border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-3 py-2'
                              >
                                <div className='mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400'>
                                  <span className='font-medium text-zinc-700 dark:text-zinc-300'>
                                    {activity.user?.name ||
                                      activity.user?.email ||
                                      "System"}
                                  </span>
                                  <span>{formatDateTime(activity.createdAt)}</span>
                                  <span className='rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 font-medium text-zinc-600 dark:text-zinc-400'>
                                    {activity.type === "WORK_LOG"
                                      ? "Work log"
                                      : activity.type === "COMMENT"
                                        ? "Comment"
                                        : "History"}
                                  </span>
                                </div>
                                <div className='mt-1 text-sm text-zinc-700 dark:text-zinc-300'>
                                  {activity.type === "COMMENT" && (
                                    <div 
                                      className='rich-text-preview text-sm text-zinc-700 dark:text-zinc-300'
                                      dangerouslySetInnerHTML={{ 
                                        __html: sanitizeRichTextHtml(activity.body || "") 
                                      }} 
                                    />
                                  )}
                                  {activity.type === "WORK_LOG" && (
                                    <p className='whitespace-pre-wrap'>
                                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                        Logged {formatDuration(activity.durationHours || 0)}
                                      </span>
                                      {activity.body ? `: ${activity.body}` : ""}
                                    </p>
                                  )}
                                  {activity.type === "HISTORY" && (
                                    <>
                                      {activity.body ? (
                                        <p className='whitespace-pre-wrap'>{activity.body}</p>
                                      ) : activity.field === "description" ? (
                                        <div className='mt-2 space-y-2'>
                                          <div className='text-xs font-semibold text-zinc-500 dark:text-zinc-400'>
                                            Changed <span className="text-zinc-800 dark:text-zinc-200 font-semibold">description</span>:
                                          </div>
                                          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                                            <div className='rounded-lg border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5 p-3'>
                                              <div className='mb-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                                                Before
                                              </div>
                                              <div 
                                                className='rich-text-preview max-h-48 overflow-y-auto text-xs text-zinc-700 dark:text-zinc-300'
                                                dangerouslySetInnerHTML={{ 
                                                  __html: sanitizeRichTextHtml(activity.fromValue || "") || "<p class='text-zinc-400 italic'>None</p>" 
                                                }} 
                                              />
                                            </div>
                                            <div className='rounded-lg border border-sky-100 dark:border-sky-500/10 bg-sky-50/30 dark:bg-sky-500/5 p-3'>
                                              <div className='mb-1.5 text-[10px] font-bold text-sky-400 dark:text-sky-400 uppercase tracking-wider'>
                                                After
                                              </div>
                                              <div 
                                                className='rich-text-preview max-h-48 overflow-y-auto text-xs text-zinc-700 dark:text-zinc-300'
                                                dangerouslySetInnerHTML={{ 
                                                  __html: sanitizeRichTextHtml(activity.toValue || "") || "<p class='text-zinc-400 italic'>None</p>" 
                                                }} 
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className='whitespace-pre-wrap'>
                                          Changed <span className="font-semibold text-zinc-800 dark:text-zinc-200">{activity.field}</span> from{" "}
                                          <span className="inline-block font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded text-xs">
                                            {activity.fromValue || "None"}
                                          </span>{" "}
                                          to{" "}
                                          <span className="inline-block font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-1.5 py-0.5 rounded text-xs">
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
                    ) : (
                      <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                        Create the task to start comments, history, and work
                        logs.
                      </p>
                    )}
                  </section>
                </div>
              </div>
              <aside className='min-h-0 overflow-y-auto border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 p-5 lg:border-l lg:border-t-0'>
                <div className='mb-4 flex items-center gap-2'>
                  <div className='relative'>
                    <button
                      type='button'
                      onClick={() => setShowStatusDropdown((v) => !v)}
                      className='flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400'
                      style={getTaskStatusInlineStyle(watch("status") || workflowStatuses[0], projectWorkflow)}
                    >
                      {watch("status") || workflowStatuses[0]}
                      <ChevronDown size={14} />
                    </button>
                    {showStatusDropdown && (
                      <>
                        <div className='fixed inset-0 z-[9]' onClick={() => setShowStatusDropdown(false)} />
                        <div className='absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl py-1 shadow-lg'>
                          {workflowStatuses.map((status: string) => (
                            <button
                              key={status}
                              type='button'
                              onClick={() => {
                                setValue("status", status, { shouldDirty: true });
                                setShowStatusDropdown(false);
                                autoSaveTask();
                              }}
                              className='flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:bg-white/5'
                            >
                              <span
                                className='inline-block rounded-full border px-2 py-0.5 text-xs font-semibold'
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
                  {workflowStatuses.indexOf(watch("status")) === workflowStatuses.length - 1 && (
                    <span className='text-xs text-zinc-500 dark:text-zinc-400'>Done</span>
                  )}
                </div>
                <div className='rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl'>
                  <div className='border-b border-zinc-200 dark:border-white/5 px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                    Details
                  </div>
                  <div className='space-y-4 p-4'>
                    <div>
                      <label className='text-xs font-medium text-zinc-500 dark:text-zinc-400'>
                        Priority
                      </label>
                      <select
                        {...register("priority", { onBlur: autoSaveTask })}
                        className='mt-1 w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='LOW'>LOW</option>
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='MEDIUM'>MEDIUM</option>
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='HIGH'>HIGH</option>
                      </select>
                    </div>
                    <div>
                      <label className='text-xs font-medium text-zinc-500 dark:text-zinc-400'>
                        Epic
                      </label>
                      <select
                        {...register("epic", { onBlur: autoSaveTask })}
                        className='mt-1 w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>No epic</option>
                        {allEpics.map((epic: string) => (
                          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={epic} value={epic}>
                            {epic}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className='text-xs font-medium text-zinc-500 dark:text-zinc-400'>
                        Labels
                      </label>
                      <input type='hidden' {...register("labels")} />
                      <div className='mt-1 flex min-h-[38px] flex-wrap gap-1.5 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl p-2'>
                        {allLabels.length === 0 ? (
                          <span className='text-sm text-zinc-400 dark:text-zinc-500'>None</span>
                        ) : (
                          allLabels.map((label: string) => {
                            const checked = selectedTaskLabels.includes(label);
                            return (
                              <button
                                key={label}
                                type='button'
                                onClick={() => toggleTaskLabel(label)}
                                className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                                  checked
                                    ? "border-sky-200 bg-sky-50 text-sky-700"
                                    : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div>
                      <label className='text-xs font-medium text-zinc-500 dark:text-zinc-400'>
                        Sprint
                      </label>
                      <select
                        {...register("sprint", { onBlur: autoSaveTask })}
                        className='mt-1 w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      >
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>No sprint</option>
                        {allSprints.map((s) => (
                          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className='text-xs font-medium text-zinc-500 dark:text-zinc-400'>
                        Time tracking
                      </label>
                      <div className='mt-1 grid grid-cols-2 gap-2'>
                        <input
                          {...register("estimateInput", {
                            onBlur: autoSaveTask,
                          })}
                          placeholder='Estimate'
                          className='rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                        <input
                          {...register("loggedInput", {
                            onBlur: autoSaveTask,
                          })}
                          placeholder='Logged'
                          className='rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {!editTask && (
                  <div className='mt-4 flex justify-end'>
                    <button
                      type='submit'
                      disabled={createTaskMutation.isPending}
                      className='flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                    >
                      {createTaskMutation.isPending && (
                        <Loader2 className='animate-spin' size={14} />
                      )}
                      Create task
                    </button>
                  </div>
                )}
              </aside>
            </form>
          </div>
        </div>
      )}

      {/* Epic & Label Manager Modal */}
      {showTaxonomyModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-2xl'>
            <div className='flex items-center justify-between mb-5'>
              <div>
                <h3 className='font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2'>
                  <Tags size={18} className='text-indigo-500' /> Epics & Labels
                </h3>
                <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-1'>
                  Create project fields before assigning them to tasks.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTaxonomyModal(false);
                  setNewEpicName("");
                  setNewLabelName("");
                }}
                className='p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500'
              >
                <X size={16} />
              </button>
            </div>

            <div className='grid gap-5 md:grid-cols-2'>
              <div className='md:col-span-2 rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <h4 className='text-sm font-semibold text-gray-800 dark:text-zinc-200'>
                      Task naming rule
                    </h4>
                    <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                      Tokens: {"{firstLabel}"}, {"{epic}"},{" "}
                      {"{remainingLabels}"}, {"{labels}"}, {"{title}"},{" "}
                      {"{sprint}"}, {"{priority}"}
                    </p>
                  </div>
                  <button
                    onClick={saveTaskNamingRule}
                    disabled={updateProjectMetadataMutation.isPending}
                    className='rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50'
                  >
                    Save rule
                  </button>
                </div>
                <input
                  value={taskNamingRuleDraft}
                  onChange={(e) => setTaskNamingRuleDraft(e.target.value)}
                  placeholder='[{firstLabel}][{epic}][{remainingLabels}] {title}'
                  className='mt-3 w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                />
                <div className='mt-3 rounded-lg bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400'>
                  Preview:{" "}
                  <span className='font-semibold text-gray-800 dark:text-zinc-200'>
                    {previewTaskNamingRule(taskNamingRuleDraft, {
                      title: "Optimize Buggy Service List API Performance",
                      epic: allEpics[0] || "Admin",
                      labels: allLabels.length
                        ? allLabels.slice(0, 2)
                        : ["BE", "Buggy"],
                    })}
                  </span>
                </div>
              </div>

              <div>
                <div className='flex items-center gap-2 mb-3'>
                  <Layers size={16} className='text-indigo-500' />
                  <h4 className='text-sm font-semibold text-gray-800 dark:text-zinc-200'>Epics</h4>
                </div>
                <div className='flex gap-2 mb-3'>
                  <input
                    value={newEpicName}
                    onChange={(e) => setNewEpicName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const name = newEpicName.trim();
                      if (name && !allEpics.includes(name)) {
                        saveProjectEpics([...allEpics, name]);
                        setNewEpicName("");
                      }
                    }}
                    placeholder='Authentication'
                    className='flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
                  />
                  <button
                    onClick={() => {
                      const name = newEpicName.trim();
                      if (name && !allEpics.includes(name)) {
                        saveProjectEpics([...allEpics, name]);
                        setNewEpicName("");
                      }
                    }}
                    className='px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700'
                  >
                    Add
                  </button>
                </div>
                <div className='space-y-1.5 max-h-64 overflow-y-auto'>
                  {allEpics.length === 0 ? (
                    <p className='text-sm text-zinc-400 dark:text-zinc-500 py-3'>No epics yet</p>
                  ) : (
                    allEpics.map((epic: string) => {
                      const taskCount =
                        project?.tasks?.filter((t: any) => t.epic === epic)
                          .length ?? 0;
                      return (
                        <div
                          key={epic}
                          className='flex items-center justify-between rounded-lg border border-zinc-200 dark:border-white/5 px-3 py-2'
                        >
                          <span className='text-sm text-zinc-700 dark:text-zinc-300'>{epic}</span>
                          <div className='flex items-center gap-2'>
                            <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                              {taskCount} task
                            </span>
                            <button
                              onClick={() => {
                                if (taskCount > 0) {
                                  toast.error(
                                    `Epic "${epic}" is used by ${taskCount} task`,
                                  );
                                  return;
                                }
                                saveProjectEpics(
                                  allEpics.filter(
                                    (value: string) => value !== epic,
                                  ),
                                );
                              }}
                              className='p-1 text-gray-300 hover:text-red-500'
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div className='flex items-center gap-2 mb-3'>
                  <Tags size={16} className='text-slate-500' />
                  <h4 className='text-sm font-semibold text-gray-800 dark:text-zinc-200'>
                    Labels
                  </h4>
                </div>
                <div className='flex gap-2 mb-3'>
                  <input
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const name = newLabelName.trim();
                      if (name && !allLabels.includes(name)) {
                        saveProjectLabels([...allLabels, name]);
                        setNewLabelName("");
                      }
                    }}
                    placeholder='FE'
                    className='flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500'
                  />
                  <button
                    onClick={() => {
                      const name = newLabelName.trim();
                      if (name && !allLabels.includes(name)) {
                        saveProjectLabels([...allLabels, name]);
                        setNewLabelName("");
                      }
                    }}
                    className='px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800'
                  >
                    Add
                  </button>
                </div>
                <div className='space-y-1.5 max-h-64 overflow-y-auto'>
                  {allLabels.length === 0 ? (
                    <p className='text-sm text-zinc-400 dark:text-zinc-500 py-3'>No labels yet</p>
                  ) : (
                    allLabels.map((label: string) => {
                      const taskCount =
                        project?.tasks?.filter((t: any) =>
                          t.labels?.includes(label),
                        ).length ?? 0;
                      return (
                        <div
                          key={label}
                          className='flex items-center justify-between rounded-lg border border-zinc-200 dark:border-white/5 px-3 py-2'
                        >
                          <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'>
                            {label}
                          </span>
                          <div className='flex items-center gap-2'>
                            <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                              {taskCount} task
                            </span>
                            <button
                              onClick={() => {
                                if (taskCount > 0) {
                                  toast.error(
                                    `Label "${label}" is used by ${taskCount} task`,
                                  );
                                  return;
                                }
                                saveProjectLabels(
                                  allLabels.filter(
                                    (value: string) => value !== label,
                                  ),
                                );
                              }}
                              className='p-1 text-gray-300 hover:text-red-500'
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sprint Manager Modal */}
      {showSprintModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-sm'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2'>
                <GitBranch size={18} className='text-blue-500' /> Quản lý Sprint
              </h3>
              <button
                onClick={() => {
                  setShowSprintModal(false);
                  setNewSprintName("");
                }}
                className='p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500'
              >
                <X size={16} />
              </button>
            </div>

            {/* Add new sprint */}
            <div className='flex gap-2 mb-4'>
              <input
                type='text'
                value={newSprintName}
                onChange={(e) => setNewSprintName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const name = newSprintName.trim();
                    if (name && !allSprints.includes(name)) {
                      saveSprints([...sprints, name]);
                      setNewSprintName("");
                    }
                  }
                }}
                placeholder='Tên sprint (vd: Sprint 1)'
                className='flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
              <button
                onClick={() => {
                  const name = newSprintName.trim();
                  if (name && !allSprints.includes(name)) {
                    saveSprints([...sprints, name]);
                    setNewSprintName("");
                  }
                }}
                className='px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1'
              >
                <Plus size={14} /> Thêm
              </button>
            </div>

            {/* Sprint list */}
            {allSprints.length === 0 ? (
              <p className='text-sm text-zinc-400 dark:text-zinc-500 text-center py-4'>
                Chưa có sprint nào
              </p>
            ) : (
              <div className='space-y-1.5 max-h-60 overflow-y-auto'>
                {allSprints.map((s) => {
                  const taskCount =
                    project?.tasks?.filter((t: any) => t.sprint === s).length ??
                    0;
                  return (
                    <div
                      key={s}
                      className='flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:bg-white/5'
                    >
                      <GitBranch
                        size={13}
                        className='text-zinc-400 dark:text-zinc-500 flex-shrink-0'
                      />
                      <span className='flex-1 text-sm text-gray-800 dark:text-zinc-200'>{s}</span>
                      <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                        {taskCount} tasks
                      </span>
                      <button
                        onClick={() => {
                          if (taskCount > 0) {
                            toast.error(
                              `Sprint "${s}" đang có ${taskCount} task, không thể xóa`,
                            );
                            return;
                          }
                          saveSprints(sprints.filter((x) => x !== s));
                        }}
                        className='p-1 text-gray-300 hover:text-red-500 rounded'
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className='mt-4 flex justify-end'>
              <button
                onClick={() => {
                  setShowSprintModal(false);
                  setNewSprintName("");
                }}
                className='px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 border rounded-lg hover:bg-zinc-50 dark:bg-white/5'
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingUploadFile && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4'>
          <div className='w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900/95 backdrop-blur-xl p-6 shadow-2xl'>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700'>
                <Upload size={18} />
              </div>
              <div className='min-w-0 flex-1'>
                <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>
                  Confirm document upload
                </h3>
                <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                  Upload this document to the project? It can be used as source
                  material when requirements are updated.
                </p>
                <div className='mt-3 rounded-lg border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 px-3 py-2'>
                  <p className='truncate text-sm font-medium text-gray-800 dark:text-zinc-200'>
                    {pendingUploadFile.name}
                  </p>
                  <p className='mt-0.5 text-xs text-zinc-400 dark:text-zinc-500'>
                    {(pendingUploadFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
            <div className='mt-5 flex justify-end gap-2'>
              <button
                type='button'
                onClick={cancelFileUpload}
                disabled={uploading}
                className='rounded-lg border border-zinc-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5 disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => uploadDocumentFile(pendingUploadFile)}
                disabled={uploading}
                className='inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'
              >
                {uploading && <Loader2 size={14} className='animate-spin' />}
                Upload document
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpdateRequirementsConfirm && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4'>
          <div className='w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900/95 backdrop-blur-xl p-6 shadow-2xl'>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700'>
                <RefreshCw size={18} />
              </div>
              <div className='min-w-0 flex-1'>
                <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>
                  Confirm requirements update
                </h3>
                <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                  AI will read the latest project documents and update the
                  shared requirements file. A new version will be added to the
                  requirements history.
                </p>
              </div>
            </div>
            <div className='mt-5 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setShowUpdateRequirementsConfirm(false)}
                disabled={updateReqMutation.isPending || activeAiJob?.type === "updateRequirements"}
                className='rounded-lg border border-zinc-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5 disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  setShowUpdateRequirementsConfirm(false);
                  updateReqMutation.mutate();
                }}
                disabled={updateReqMutation.isPending || activeAiJob?.type === "updateRequirements"}
                className='inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'
              >
                {(updateReqMutation.isPending || activeAiJob?.type === "updateRequirements") && (
                  <Loader2 size={14} className='animate-spin' />
                )}
                Update requirements
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
