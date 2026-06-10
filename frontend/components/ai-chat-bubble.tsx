"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePathname } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, aiApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  ChevronDown,
  Trash2,
  MessageSquare,
  ListChecks,
  CheckCircle,
  ChevronLeft,
  Plus,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";

interface SuggestedTask {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string;
  sprint?: string;
  estimateHours?: number;
  loggedHours?: number;
  assigneeId?: number | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedTasks?: SuggestedTask[];
  tasksCreated?: { id: string; title: string }[];
  agentLogs?: { type: string; name: string; duration: number; details?: string }[];
}

interface ChatSession {
  id: number;
  name: string;
  createdAt: string;
  summary: string | null;
  messages: ChatMessage[];
}

function sessionName() {
  const now = new Date();
  return `Phiên ${now.toLocaleDateString("vi-VN")} ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
const HOURS_PER_WORK_DAY = 8;

function toHours(value: any) {
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : 0;
}

function durationFromHours(value: any) {
  const totalMinutes = Math.max(0, Math.round(toHours(value) * 60));
  const minutesPerDay = HOURS_PER_WORK_DAY * 60;
  const days = Math.floor(totalMinutes / minutesPerDay);
  const remainingMinutes = totalMinutes % minutesPerDay;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  return { days, hours, minutes };
}

function durationToHours(days: any, hours: any, minutes: any) {
  const total =
    toHours(days) * HOURS_PER_WORK_DAY + toHours(hours) + toHours(minutes) / 60;
  return Math.round(total * 10000) / 10000;
}

export default function AiChatBubble() {
  const { user } = useAuth();
  const pathname = usePathname();
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

    const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState("");
  const [reviewTasks, setReviewTasks] = useState<SuggestedTask[] | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const messages = (activeSession?.messages ?? []) as ChatMessage[];
  const summary = activeSession?.summary ?? "";

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

  // Detect project from URL
  const urlProjectId = (() => {
    const match = pathname.match(/\/projects\/(\d+)/);
    return match ? Number(match[1]) : null;
  })();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-bubble"],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
    enabled: !!user,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<
    ChatSession[]
  >({
    queryKey: ["ai-sessions", selectedProjectId],
    queryFn: () => aiApi.listSessions(selectedProjectId!).then((r) => r.data),
    enabled: !!selectedProjectId && !!user,
  });

  // Auto-select project from URL
  useEffect(() => {
    if (urlProjectId && urlProjectId !== selectedProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId]);

    // When sessions load for a project, pick the first one (or create one)
  useEffect(() => {
    if (!selectedProjectId) return;
    setReviewTasks(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || sessionsLoading) return;
    if (sessions.length > 0) {
      // Only set if not already on a valid session for this project
      if (!activeSession || !sessions.find((s) => s.id === activeSession.id)) {
        setActiveSession(sessions[0]);
      }
    } else {
      // No sessions yet — create one
      createSessionMutation.mutate(sessionName());
    }
  }, [sessions, sessionsLoading, selectedProjectId]);

    // Scroll to bottom on new messages
  useEffect(() => {
    if (open && !reviewTasks) {
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  }, [messages, open, reviewTasks]);

  // ── session mutations ────────────────────────────────────────────────────────
    const createSessionMutation = useMutation({
    mutationFn: (name: string) =>
      aiApi.createSession(selectedProjectId!, name).then((r) => r.data),
    onSuccess: (created: ChatSession) => {
      qc.invalidateQueries({ queryKey: ["ai-sessions", selectedProjectId] });
      setActiveSession(created);
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: (data: { name?: string; summary?: string; messages?: any[] }) =>
      aiApi
        .updateSession(selectedProjectId!, activeSession!.id, data)
        .then((r) => r.data),
    onSuccess: (updated: ChatSession) => {
      setActiveSession(updated);
      qc.setQueryData(
        ["ai-sessions", selectedProjectId],
        (prev: ChatSession[] = []) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) =>
      aiApi.deleteSession(selectedProjectId!, sessionId),
    onSuccess: (_data, deletedId) => {
      const remaining = sessions.filter((s) => s.id !== deletedId);
      qc.setQueryData(["ai-sessions", selectedProjectId], remaining);
      if (activeSession?.id === deletedId) {
        if (remaining.length > 0) {
          setActiveSession(remaining[0]);
        } else {
          createSessionMutation.mutate(sessionName());
        }
      }
    },
  });

  // ── session helpers ──────────────────────────────────────────────────────────
  const updateSession = (updated: ChatSession) => {
    setActiveSession(updated);
    updateSessionMutation.mutate({
      messages: updated.messages,
      summary: updated.summary ?? undefined,
    });
  };

    const switchSession = (session: ChatSession) => {
    setActiveSession(session);
    setReviewTasks(null);
  };

  const handleNewSession = () => {
    if (!selectedProjectId) return;
    createSessionMutation.mutate(sessionName());
    setReviewTasks(null);
  };

  const handleDeleteSession = (sid: number) => {
    deleteSessionMutation.mutate(sid);
  };

  // ── mutations ────────────────────────────────────────────────────────────────
  const summarizeMutation = useMutation({
    mutationFn: ({
      session,
      newMsgs,
    }: {
      session: ChatSession;
      newMsgs: ChatMessage[];
    }) =>
      aiApi
        .summarize(
          selectedProjectId!,
          session.summary ?? "",
          newMsgs.map((m) => ({ role: m.role, content: m.content })),
        )
        .then((r) => ({ session, newSummary: r.data as string })),
    onSuccess: ({ session, newSummary }) => {
      const updated = { ...session, summary: newSummary };
      setActiveSession(updated);
      updateSessionMutation.mutate({ summary: newSummary });
      qc.setQueryData(
        ["ai-sessions", selectedProjectId],
        (prev: ChatSession[] = []) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });



  const confirmMutation = useMutation({
    mutationFn: (tasks: SuggestedTask[]) =>
      aiApi.confirmTasks(selectedProjectId!, tasks).then((r) => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["project", selectedProjectId] });
      const createdList = created.map((t: any) => ({
        id: t.id,
        title: t.title,
      }));
      const newMessages = messages.map((m, i) =>
        i === messages.length - 1 && m.suggestedTasks
          ? { ...m, suggestedTasks: undefined, tasksCreated: createdList }
          : m,
      );
      updateSession({ ...activeSession!, messages: newMessages });
      setReviewTasks(null);
      toast.success(`Đã tạo ${created.length} task`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const send = async () => {
    const msg = input.trim();
    if (!msg || !selectedProjectId || !activeSession || isStreaming)
      return;

    setInput("");
    setIsStreaming(true);

    // 1. Render user message and assistant placeholder immediately on UI
    const userMsg: ChatMessage = { role: "user" as const, content: msg };
    const assistantPlaceholder: ChatMessage = { role: "assistant" as const, content: "", agentLogs: [] };
    const updatedMessages = [...messages, userMsg];
    
    setActiveSession({
      ...activeSession,
      messages: [...updatedMessages, assistantPlaceholder]
    });

    // Scroll to bottom
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

    let assistantContent = "";
    let suggestedTasksLocal: SuggestedTask[] = [];
    let assistantLogsLocal: any[] = [];

    try {
      // 2. Save user message to database immediately
      await updateSessionMutation.mutateAsync({
        messages: updatedMessages,
      });

      // 3. Send message to AI API using stream
      await aiApi.chatStream(
        selectedProjectId,
        updatedMessages
          .filter((m) => m.content && m.content.trim() !== "")
          .map((m) => ({ role: m.role, content: m.content })),
        summary || undefined,
        (chunk) => {
          assistantContent += chunk;
          setActiveSession((prev) => {
            if (!prev) return prev;
            const nextMessages = [...prev.messages];
            if (nextMessages.length > 0 && nextMessages[nextMessages.length - 1].role === "assistant") {
              nextMessages[nextMessages.length - 1] = {
                ...nextMessages[nextMessages.length - 1],
                content: assistantContent,
              };
            }
            return { ...prev, messages: nextMessages };
          });
        },
        (tasks) => {
          suggestedTasksLocal = tasks;
        },
        async () => {
          // Done streaming, finalize the session in database
          const finalMessages = [...updatedMessages, {
            role: "assistant" as const,
            content: assistantContent,
            suggestedTasks: suggestedTasksLocal.length ? suggestedTasksLocal : undefined,
            agentLogs: assistantLogsLocal.length ? assistantLogsLocal : undefined,
          }];

          const finalSavedSession = await updateSessionMutation.mutateAsync({
            messages: finalMessages,
          });
          setActiveSession(finalSavedSession);

          if (suggestedTasksLocal.length > 0) {
            setReviewTasks(suggestedTasksLocal);
          }

          setIsStreaming(false);

          // 6. Summarize in the background
          summarizeMutation.mutate({
            session: finalSavedSession,
            newMsgs: finalMessages,
          });
        },
        (error) => {
          console.error("AI chat stream failed:", error);
          toast.error(error.message || "Chat failed");

          const errorMsg: ChatMessage = {
            role: "assistant",
            content: "⚠️ [Lỗi]: Đã xảy ra lỗi khi kết nối tới AI. Tin nhắn của bạn đã được lưu lại, vui lòng thử lại sau.",
          };
          setActiveSession({
            ...activeSession,
            messages: [...updatedMessages, errorMsg],
          });
          setIsStreaming(false);
        },
        (log) => {
          assistantLogsLocal.push(log);
          setActiveSession((prev) => {
            if (!prev) return prev;
            const nextMessages = [...prev.messages];
            if (nextMessages.length > 0 && nextMessages[nextMessages.length - 1].role === "assistant") {
              nextMessages[nextMessages.length - 1] = {
                ...nextMessages[nextMessages.length - 1],
                agentLogs: [...assistantLogsLocal],
              };
            }
            return { ...prev, messages: nextMessages };
          });
        }
      );
    } catch (error: any) {
      console.error("AI chat failed:", error);
      toast.error(error.message || "Chat failed");
      setIsStreaming(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className='fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-lg ring-1 ring-zinc-200 dark:ring-zinc-800 transition-all hover:scale-105 hover:shadow-xl'
        >
          <BrandLogo size={42} />
        </button>
      )}

      {/* ChatGPT-style Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop overlay (click outside to close) */}
          <div 
            className="absolute inset-0" 
            onClick={() => {
              setOpen(false);
              setReviewTasks(null);
            }}
          />
          
          {/* Main Modal Container */}
          <div className="relative w-[75vw] h-[80vh] max-w-6xl max-h-[850px] min-h-[500px] bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl flex border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden z-10 transition-all duration-300">
            
            {/* Sidebar (Left Column) */}
            <div className="w-72 flex-shrink-0 flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-full">
              {/* Project & New Chat Area */}
              <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 space-y-3 flex-shrink-0">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Dự án
                  </label>
                  <div className="relative">
                    <select
                      value={selectedProjectId ?? ""}
                      onChange={(e) =>
                        setSelectedProjectId(Number(e.target.value) || null)
                      }
                      className="w-full appearance-none text-xs border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl px-3.5 py-2.5 pr-8 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 text-zinc-800 dark:text-zinc-200 font-medium transition-all shadow-sm"
                    >
                      <option value="">— Chọn dự án —</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 pointer-events-none"
                    />
                  </div>
                </div>

                {selectedProjectId && (
                  <button
                    onClick={handleNewSession}
                    className="w-full py-2.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    <Plus size={14} /> Phiên chat mới
                  </button>
                )}
              </div>

              {/* Sessions History List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {selectedProjectId && (
                  <>
                    <div className="px-2 pb-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Lịch sử trò chuyện
                    </div>
                    {sessionsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 size={16} className="animate-spin text-zinc-400" />
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">
                        Không có phiên chat nào
                      </p>
                    ) : (
                      sessions.map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            "group relative flex items-center justify-between rounded-xl p-2.5 cursor-pointer transition-all",
                            s.id === activeSession?.id
                              ? "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 font-medium"
                              : "hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 text-zinc-650 dark:text-zinc-400"
                          )}
                          onClick={() => switchSession(s)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-6">
                            <MessageSquare size={13} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                            <div className="truncate text-xs leading-normal">
                              {s.name}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(s.id);
                            }}
                            className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 rounded transition-opacity"
                            title="Xóa phiên"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>

              {/* User Profiling (Bottom Sidebar) */}
              <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-100/10 dark:bg-zinc-900/10 flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-indigo-500/10">
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {user.name || "User"}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[180px] sm:max-w-[280px] md:max-w-[420px]">
                    {user.email || ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Area (Right Column) */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-950 flex-shrink-0 border-b border-zinc-200/60 dark:border-zinc-800/60">
                {reviewTasks && (
                  <button
                    onClick={() => setReviewTasks(null)}
                    className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 mr-2 transition-colors"
                  >
                    <ChevronLeft size={16} className="text-zinc-500 dark:text-zinc-400" />
                  </button>
                )}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <BrandLogo size={24} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {reviewTasks
                        ? `Review ... đề xuất`
                        : activeSession?.name || "AI Assistant"}
                    </p>
                    {!reviewTasks && summary && (
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                        {summary}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    setReviewTasks(null);
                  }}
                  className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {reviewTasks ? (
                /* ── Review panel ────────────────────────────────────────────── */
                <div
                  className="flex flex-col overflow-hidden flex-1 animate-in fade-in duration-200"
                >
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {reviewTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-150 dark:border-zinc-850 p-4 space-y-3"
                      >
                        <input
                          className="w-full text-sm font-semibold bg-transparent border-b border-zinc-200 dark:border-zinc-800 pb-1.5 focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-100"
                          value={task.title}
                          onChange={(e) =>
                            setReviewTasks((prev) =>
                              prev!.map((t, i) =>
                                i === idx ? { ...t, title: e.target.value } : t,
                              ),
                            )
                          }
                        />
                        {task.description !== undefined && (
                          <textarea
                            rows={2}
                            className="w-full text-xs text-zinc-650 dark:text-zinc-400 bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-none"
                            value={task.description || ""}
                            onChange={(e) =>
                              setReviewTasks((prev) =>
                                prev!.map((t, i) =>
                                  i === idx
                                    ? { ...t, description: e.target.value }
                                    : t,
                                ),
                              )
                            }
                          />
                        )}
                        <div className="flex gap-3">
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
                            className="flex-1 text-xs border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                          >
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                          <input
                            type="date"
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
                            className="flex-1 text-xs border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                          />
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                              Estimate
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="number"
                                min="0"
                                placeholder="Days"
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
                                className="w-full text-xs border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                              />
                              <input
                                type="number"
                                min="0"
                                max={HOURS_PER_WORK_DAY - 1}
                                placeholder="Hours"
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
                                className="w-full text-xs border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                              />
                              <input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="Mins"
                                value={
                                  durationFromHours(task.estimateHours).minutes ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateReviewTaskDuration(
                                    idx,
                                    "estimateHours",
                                    "minutes",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                              Logged
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="number"
                                min="0"
                                placeholder="Days"
                                value={
                                  durationFromHours(task.loggedHours).days || ""
                                }
                                onChange={(e) =>
                                  updateReviewTaskDuration(
                                    idx,
                                    "loggedHours",
                                    "days",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                              />
                              <input
                                type="number"
                                min="0"
                                max={HOURS_PER_WORK_DAY - 1}
                                placeholder="Hours"
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
                                className="w-full text-xs border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                              />
                              <input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="Mins"
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
                                className="w-full text-xs border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-700 dark:text-zinc-300"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() =>
                              setReviewTasks((prev) =>
                                prev!.filter((_, i) => i !== idx),
                              )
                            }
                            className="text-xs text-red-500 hover:text-red-650 font-medium flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={12} /> Xóa task này
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 flex gap-3 flex-shrink-0">
                    <button
                      onClick={() => setReviewTasks(null)}
                      className="flex-1 py-2.5 text-xs text-zinc-650 dark:text-zinc-350 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors font-medium"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() =>
                        reviewTasks.length > 0 &&
                        confirmMutation.mutate(reviewTasks)
                      }
                      disabled={
                        confirmMutation.isPending || reviewTasks.length === 0
                      }
                      className="flex-1 py-2.5 text-xs bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 font-semibold shadow-md shadow-zinc-900/10 dark:shadow-none"
                    >
                      {confirmMutation.isPending ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle size={13} />
                      )}
                      Tạo {reviewTasks.length} tasks
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Chat view ───────────────────────────────────────────────── */
                <>
                  <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
                    <div className="max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
                      {!selectedProjectId ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-zinc-800/60">
                            <MessageSquare size={26} className="text-zinc-300 dark:text-zinc-700" />
                          </div>
                          <p className="text-sm text-zinc-400 dark:text-zinc-500 font-medium">
                            Chọn project để bắt đầu chat với AI
                          </p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-center border border-indigo-100/50 dark:border-indigo-900/30">
                            <Bot size={26} className="text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <p className="text-sm text-zinc-650 dark:text-zinc-400 font-semibold">
                            Chat với AI về dự án
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm">
                            Ví dụ: &quot;Tạo tasks cho module đăng nhập&quot; hoặc nhờ giải thích cấu trúc code.
                          </p>
                        </div>
                      ) : (
                        messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex gap-4 p-4 rounded-2xl transition-all",
                              msg.role === "assistant"
                                ? "bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900/40 animate-in fade-in duration-300"
                                : ""
                            )}
                          >
                            <div className="flex-shrink-0">
                              {msg.role === "assistant" ? (
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/10 text-white">
                                  <Bot size={15} />
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 rounded-xl flex items-center justify-center text-zinc-700 dark:text-zinc-200 shadow-sm font-bold text-xs">
                                  {user.name ? user.name[0].toUpperCase() : "U"}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                              {msg.role === "user" ? (
                                <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                              ) : (
                                <div className="whitespace-pre-wrap leading-relaxed break-words">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm as any]}
                                    components={{
                                      p: ({node, ...props}: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                      ul: ({node, ...props}: any) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                                      ol: ({node, ...props}: any) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                                      li: ({node, ...props}: any) => <li className="mb-0.5" {...props} />,
                                      h1: ({node, ...props}: any) => <h1 className="text-sm font-extrabold mt-3 mb-1.5 text-zinc-900 dark:text-zinc-50 uppercase tracking-wider" {...props} />,
                                      h2: ({node, ...props}: any) => <h2 className="text-sm font-bold mt-3 mb-1.5 text-zinc-900 dark:text-zinc-50" {...props} />,
                                      h3: ({node, ...props}: any) => <h3 className="text-xs font-semibold mt-2.5 mb-1 text-zinc-900 dark:text-zinc-50" {...props} />,
                                      code: ({node, ...props}: any) => <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-600 dark:text-indigo-400" {...props} />,
                                      table: ({node, ...props}: any) => (
                                        <div className="overflow-x-auto my-2 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                          <table className="w-full border-collapse text-xs" {...props} />
                                        </div>
                                      ),
                                      th: ({node, ...props}: any) => <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-zinc-100/50 dark:bg-zinc-900/50 font-bold text-left" {...props} />,
                                      td: ({node, ...props}: any) => <td className="border-b border-zinc-100 dark:border-zinc-900/50 px-3 py-2 text-zinc-650 dark:text-zinc-300" {...props} />
                                    } as any}
                                  >
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                              {msg.suggestedTasks?.length ? (
                                <div className="mt-3 pt-2.5 border-t border-indigo-100 dark:border-indigo-950/40">
                                  <button
                                    onClick={() =>
                                      setReviewTasks(msg.suggestedTasks!)
                                    }
                                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                                  >
                                    <ListChecks size={13} />
                                    Review {msg.suggestedTasks.length} task đề xuất
                                  </button>
                                </div>
                              ) : null}
                              {msg.tasksCreated?.length ? (
                                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-900/40 space-y-1">
                                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-450 flex items-center gap-1.5">
                                    <CheckCircle size={12} /> Đã tạo tasks:
                                  </p>
                                  {msg.tasksCreated.map((t) => (
                                    <p
                                      key={t.id}
                                      className="text-xs text-emerald-600 dark:text-emerald-450 flex items-center gap-1.5 pl-1.5"
                                    >
                                      <span className="font-mono text-[10px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-1 py-0.5 rounded text-emerald-700 dark:text-emerald-400">{t.id}</span>
                                      <span>{t.title}</span>
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              {msg.agentLogs && msg.agentLogs.length > 0 && (
                                <div className="mt-3 pt-2.5 border-t border-zinc-150/80 dark:border-zinc-800/40">
                                  <details className="group">
                                    <summary className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 cursor-pointer select-none font-semibold">
                                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span>Agent Logs ({msg.agentLogs.reduce((sum, l) => sum + l.duration, 0)}ms)</span>
                                      <ChevronDown size={11} className="ml-auto transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="mt-2 pl-3 border-l-2 border-indigo-500/20 space-y-2 max-h-48 overflow-y-auto">
                                      {msg.agentLogs.map((log, lIdx) => (
                                        <div key={lIdx} className="text-[11px]">
                                          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 font-semibold">
                                            <span className={cn(log.type === "llm_call" ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-450")}>
                                              {log.name}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono bg-zinc-100 dark:bg-white/5 px-1 py-0.5 rounded">
                                              {log.duration}ms
                                            </span>
                                          </div>
                                          {log.details && (
                                            <pre className="mt-1 p-2 rounded-xl bg-zinc-50 dark:bg-black/15 text-[10px] text-zinc-500 dark:text-zinc-500 overflow-x-auto font-mono whitespace-pre-wrap break-all border border-zinc-200/40 dark:border-white/5">
                                              {log.details}
                                            </pre>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      {isStreaming && (
                        <div className="flex gap-4 p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900/40">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/10 text-white">
                              <Bot size={15} />
                            </div>
                          </div>
                          <div className="flex-1 flex items-center">
                            <Loader2
                              size={15}
                              className="animate-spin text-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>
                  </div>

                  {/* Input Form */}
                  <div className="border-t border-zinc-100 dark:border-zinc-900/60 bg-white dark:bg-zinc-950 p-4 flex-shrink-0">
                    <div className="max-w-3xl mx-auto w-full relative flex items-end">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        disabled={!selectedProjectId}
                        placeholder={
                          selectedProjectId
                            ? "Nhập tin nhắn..."
                            : "Chọn project trước"
                        }
                        rows={1}
                        className="w-full resize-none text-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-4 pr-12 py-3.5 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 disabled:bg-zinc-50 dark:disabled:bg-zinc-900 disabled:text-zinc-400 transition-all max-h-36 overflow-y-auto shadow-inner"
                        style={{ height: "52px" }}
                      />
                      <button
                        onClick={send}
                        disabled={
                          !input.trim() ||
                          !selectedProjectId ||
                          isStreaming
                        }
                        className="absolute right-2.5 bottom-2.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white p-2 rounded-xl disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center shadow-md shadow-black/5"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
