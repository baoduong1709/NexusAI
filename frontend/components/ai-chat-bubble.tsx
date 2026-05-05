"use client";

import { useState, useRef, useEffect } from "react";
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
  tasksCreated?: { id: number; title: string }[];
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
  const [showSessions, setShowSessions] = useState(false);

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
    setShowSessions(false);
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
    if (open && !showSessions && !reviewTasks) {
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  }, [messages, open, showSessions, reviewTasks]);

  // ── session mutations ────────────────────────────────────────────────────────
  const createSessionMutation = useMutation({
    mutationFn: (name: string) =>
      aiApi.createSession(selectedProjectId!, name).then((r) => r.data),
    onSuccess: (created: ChatSession) => {
      qc.invalidateQueries({ queryKey: ["ai-sessions", selectedProjectId] });
      setActiveSession(created);
      setShowSessions(false);
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
    setShowSessions(false);
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

  const chatMutation = useMutation({
    mutationFn: (userMsg: string) => {
      const next = [...messages, { role: "user" as const, content: userMsg }];
      return aiApi
        .chat(
          selectedProjectId!,
          next.map((m) => ({ role: m.role, content: m.content })),
          summary,
        )
        .then((r) => ({ userMsg, data: r.data }));
    },
    onSuccess: ({ userMsg, data }) => {
      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: userMsg },
        {
          role: "assistant",
          content: data.message,
          suggestedTasks: data.suggestedTasks?.length
            ? data.suggestedTasks
            : undefined,
        },
      ];
      const updatedSession = { ...activeSession!, messages: newMessages };
      updateSession(updatedSession);
      if (data.suggestedTasks?.length) setReviewTasks(data.suggestedTasks);
      // Async: update summary after each exchange
      summarizeMutation.mutate({
        session: updatedSession,
        newMsgs: newMessages,
      });
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Chat failed"),
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

  const send = () => {
    const msg = input.trim();
    if (!msg || !selectedProjectId || !activeSession || chatMutation.isPending)
      return;
    setInput("");
    chatMutation.mutate(msg);
  };

  if (!user) return null;

  return (
    <>
      {/* Bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className='fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-gray-200 transition-all hover:scale-105'
        >
          <BrandLogo size={42} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className='fixed bottom-6 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden'
          style={{ height: reviewTasks ? "auto" : "560px", maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className='flex items-center gap-2 px-4 py-3 bg-slate-900 text-white flex-shrink-0'>
            {reviewTasks && (
              <button
                onClick={() => setReviewTasks(null)}
                className='p-1 rounded hover:bg-slate-800'
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <BrandLogo size={24} />
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold truncate'>
                {reviewTasks
                  ? `Review ${reviewTasks.length} tasks đề xuất`
                  : showSessions
                    ? "Lịch sử phiên chat"
                    : activeSession?.name || "AI Assistant"}
              </p>
              {!reviewTasks && !showSessions && summary && (
                <p className='text-xs text-sky-200 truncate'>
                  {summary.slice(0, 55)}…
                </p>
              )}
            </div>
            {!reviewTasks && (
              <button
                onClick={() => setShowSessions((v) => !v)}
                title='Phiên chat'
                className={cn(
                  "p-1 rounded hover:bg-slate-800",
                  showSessions && "bg-slate-800",
                )}
              >
                <History size={14} />
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                setReviewTasks(null);
                setShowSessions(false);
              }}
              className='p-1 rounded hover:bg-slate-800'
            >
              <X size={16} />
            </button>
          </div>

          {/* Project selector — hidden in review/sessions mode */}
          {!reviewTasks && !showSessions && (
            <div className='px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0'>
              <div className='relative'>
                <select
                  value={selectedProjectId ?? ""}
                  onChange={(e) =>
                    setSelectedProjectId(Number(e.target.value) || null)
                  }
                  className='w-full appearance-none text-xs border border-gray-200 rounded-lg px-3 py-2 pr-7 bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 text-gray-700'
                >
                  <option value=''>— Chọn project —</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'
                />
              </div>
            </div>
          )}

          {/* ── Sessions panel ─────────────────────────────────────────────── */}
          {showSessions ? (
            <div className='flex-1 overflow-y-auto p-3 space-y-2'>
              <button
                onClick={handleNewSession}
                className='w-full py-2 text-xs bg-sky-50 border border-sky-200 text-sky-700 rounded-lg hover:bg-sky-100 flex items-center justify-center gap-1.5 font-medium'
              >
                <Plus size={12} /> Phiên chat mới
              </button>
              {sessions.length === 0 && (
                <p className='text-xs text-gray-400 text-center py-4'>
                  Chọn project để xem phiên chat
                </p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group rounded-lg border p-2.5 cursor-pointer hover:bg-gray-50",
                    s.id === activeSession?.id
                      ? "border-sky-200 bg-sky-50"
                      : "border-gray-100",
                  )}
                  onClick={() => switchSession(s)}
                >
                  <div className='flex items-center justify-between gap-1'>
                    <p className='text-xs font-medium text-gray-800 truncate flex-1'>
                      {s.name}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(s.id);
                      }}
                      className='opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 rounded flex-shrink-0'
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <p className='text-xs text-gray-400 mt-0.5'>
                    {new Date(s.createdAt).toLocaleDateString("vi-VN")} ·{" "}
                    {s.messages.length} tin nhắn
                  </p>
                  {s.summary && (
                    <p className='text-xs text-gray-500 mt-1 line-clamp-2'>
                      {s.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : reviewTasks ? (
            /* ── Review panel ────────────────────────────────────────────── */
            <div
              className='flex flex-col overflow-hidden'
              style={{ maxHeight: "calc(90vh - 56px)" }}
            >
              <div className='flex-1 overflow-y-auto p-3 space-y-2'>
                {reviewTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className='bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2'
                  >
                    <input
                      className='w-full text-sm font-medium bg-transparent border-b border-gray-200 pb-1 focus:outline-none focus:border-sky-400'
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
                        className='w-full text-xs text-gray-600 bg-transparent border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300 resize-none'
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
                    <div className='flex gap-2'>
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
                        className='flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
                      >
                        <option value='HIGH'>HIGH</option>
                        <option value='MEDIUM'>MEDIUM</option>
                        <option value='LOW'>LOW</option>
                      </select>
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
                        className='flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <div>
                        <p className='text-[11px] text-gray-400 mb-1'>
                          Estimate
                        </p>
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
                            className='w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
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
                            className='w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
                          />
                          <input
                            type='number'
                            min='0'
                            max='59'
                            placeholder='Mins'
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
                            className='w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
                          />
                        </div>
                      </div>
                      <div>
                        <p className='text-[11px] text-gray-400 mb-1'>
                          Logged
                        </p>
                        <div className='grid grid-cols-3 gap-1.5'>
                          <input
                            type='number'
                            min='0'
                            placeholder='Days'
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
                            className='w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
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
                            className='w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
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
                            className='w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300'
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setReviewTasks((prev) =>
                          prev!.filter((_, i) => i !== idx),
                        )
                      }
                      className='text-xs text-red-400 hover:text-red-600'
                    >
                      Xóa task này
                    </button>
                  </div>
                ))}
              </div>
              <div className='p-3 border-t border-gray-100 flex gap-2 flex-shrink-0'>
                <button
                  onClick={() => setReviewTasks(null)}
                  className='flex-1 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50'
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
                  className='flex-1 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-1'
                >
                  {confirmMutation.isPending ? (
                    <Loader2 size={12} className='animate-spin' />
                  ) : (
                    <CheckCircle size={12} />
                  )}
                  Tạo {reviewTasks.length} tasks
                </button>
              </div>
            </div>
          ) : (
            /* ── Chat view ───────────────────────────────────────────────── */
            <>
              <div className='flex-1 overflow-y-auto p-3 space-y-3'>
                {!selectedProjectId ? (
                  <div className='flex flex-col items-center justify-center h-full text-center gap-2'>
                    <MessageSquare size={32} className='text-gray-200' />
                    <p className='text-sm text-gray-400'>
                      Chọn project để bắt đầu chat với AI
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className='flex flex-col items-center justify-center h-full text-center gap-2'>
                    <Bot size={32} className='text-sky-200' />
                    <p className='text-sm text-gray-400'>
                      Chat với AI về project
                    </p>
                    <p className='text-xs text-gray-300'>
                      Ví dụ: "Tạo tasks cho module đăng nhập"
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex gap-2",
                        msg.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className='w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                          <Bot size={12} className='text-sky-700' />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed",
                          msg.role === "user"
                            ? "bg-slate-900 text-white rounded-tr-sm"
                            : "bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100",
                        )}
                      >
                        {msg.content}
                        {msg.suggestedTasks?.length ? (
                          <div className='mt-2 pt-2 border-t border-sky-200/50'>
                            <button
                              onClick={() =>
                                setReviewTasks(msg.suggestedTasks!)
                              }
                              className='flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-slate-900'
                            >
                              <ListChecks size={11} />
                              Review {msg.suggestedTasks.length} task đề xuất
                            </button>
                          </div>
                        ) : null}
                        {msg.tasksCreated?.length ? (
                          <div className='mt-2 pt-2 border-t border-gray-200/50 space-y-0.5'>
                            <p className='font-semibold text-green-700 flex items-center gap-1'>
                              <CheckCircle size={10} /> Đã tạo:
                            </p>
                            {msg.tasksCreated.map((t) => (
                              <p
                                key={t.id}
                                className='text-green-700 flex items-center gap-1'
                              >
                                <CheckCircle size={9} /> {t.title}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {msg.role === "user" && (
                        <div className='w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                          <User size={12} className='text-sky-700' />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {chatMutation.isPending && (
                  <div className='flex gap-2'>
                    <div className='w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0'>
                      <Bot size={12} className='text-sky-700' />
                    </div>
                    <div className='bg-gray-50 border border-gray-100 rounded-xl px-3 py-2'>
                      <Loader2
                        size={12}
                        className='animate-spin text-sky-500'
                      />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className='p-3 border-t border-gray-100 flex gap-2 flex-shrink-0'>
                <textarea
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
                  rows={2}
                  className='flex-1 resize-none text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:bg-gray-50 disabled:text-gray-400'
                />
                <button
                  onClick={send}
                  disabled={
                    !input.trim() ||
                    !selectedProjectId ||
                    chatMutation.isPending
                  }
                  className='flex-shrink-0 bg-slate-900 text-white px-3 rounded-lg hover:bg-slate-800 disabled:opacity-40'
                >
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
