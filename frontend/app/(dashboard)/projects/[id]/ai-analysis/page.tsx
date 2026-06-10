"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi, projectsApi } from "@/lib/api";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Send,
  FileText,
  Bot,
  User,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tasksCreated?: { id: string; title: string }[];
  agentLogs?: { type: string; name: string; duration: number; details?: string }[];
}

export default function AiAnalysisPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<"init" | "analyzed" | "chat">("init");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getOne(projectId).then((r) => r.data),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const analyzeMutation = useMutation({
    mutationFn: () => aiApi.analyze(projectId).then((r) => r.data),
    onSuccess: (data) => {
      setAnalysisResult(data);
      setPhase("analyzed");
      setMessages([
        {
          role: "assistant",
          content: `I finished analyzing **${project?.name}** and generated a requirements.md file.\n\n**Summary:** ${data.summary}\n\nYou can now chat with me to create tasks. For example:\n- "Create tasks for the login module"\n- "Create QA tasks for feature X"\n- "Create 3 backend API tasks"`,
        },
      ]);
      toast.success("Analysis completed. requirements.md has been created.");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Analysis failed"),
  });

  const [chatLoading, setChatLoading] = useState(false);
  const chatMutation = { isPending: chatLoading };

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || chatLoading) return;
    setInput("");
    setChatLoading(true);

    const userMessage: ChatMessage = { role: "user", content: msg };
    const assistantPlaceholder: ChatMessage = { role: "assistant", content: "", agentLogs: [] };

    const newMessages = [...messages, userMessage];
    setMessages([...newMessages, assistantPlaceholder]);

    let assistantContent = "";
    let suggestedTasksLocal: any[] = [];
    let assistantLogsLocal: any[] = [];
    const language = (typeof window !== "undefined" ? localStorage.getItem("nexusai_chat_lang") : null) || "vi";

    try {
      await aiApi.chatStream(
        projectId,
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        undefined,
        (chunk) => {
          assistantContent += chunk;
          setMessages((prev) => {
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
          let createdTasks: any[] = [];
          if (suggestedTasksLocal.length > 0) {
            try {
              const responseData = await aiApi.confirmTasks(projectId, suggestedTasksLocal).then((r) => r.data);
              createdTasks = responseData || [];
              qc.invalidateQueries({ queryKey: ["project", projectId] });
              toast.success(`Created ${createdTasks.length} tasks`);
            } catch (e: any) {
              console.error("Failed to auto-create tasks", e);
              toast.error(e.response?.data?.message || "Failed to create tasks");
            }
          }

          setMessages((prev) => {
            const next = [...prev];
            if (next.length > 0 && next[next.length - 1].role === "assistant") {
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: assistantContent,
                tasksCreated: createdTasks.length
                  ? createdTasks.map((t) => ({ id: t.id, title: t.title }))
                  : undefined,
                agentLogs: assistantLogsLocal.length ? assistantLogsLocal : undefined,
              };
            }
            return next;
          });

          setChatLoading(false);
        },
        (error) => {
          console.error("Stream error", error);
          toast.error(error.message || "Stream connection lost");
          if (!assistantContent) {
            setMessages((prev) => prev.slice(0, -1));
          }
          setChatLoading(false);
        },
        (log) => {
          assistantLogsLocal.push(log);
          setMessages((prev) => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className='flex flex-col h-[calc(100vh-8rem)] max-w-4xl space-y-0'>
      <div className='flex items-center gap-3 mb-4 flex-shrink-0'>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg'
        >
          <ChevronLeft size={20} />
        </button>
        <div className='flex items-center gap-2'>
          <BrandLogo size={36} />
          <div>
            <h1 className='text-xl font-bold text-gray-900 dark:text-zinc-200'>AI Assistant</h1>
            <p className='text-sm text-gray-400'>{project?.name}</p>
          </div>
        </div>
        {analysisResult?.requirementsFile && (
          <span className='ml-auto flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full'>
            <FileText size={12} /> requirements.md created
          </span>
        )}
      </div>

      {phase === "init" && (
        <div className='flex-1 flex items-center justify-center'>
          <div className='bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-10 text-center max-w-lg w-full'>
            <BrandLogo size={56} className='mx-auto mb-4' />
            <h2 className='text-lg font-semibold text-gray-800 mb-2 dark:text-zinc-200'>
              Analyze project documents
            </h2>
            <p className='text-gray-500 text-sm mb-6'>
              AI will read your documents, generate a{" "}
              <strong>requirements.md</strong> file, and open the chat so you
              can create tasks from natural-language prompts.
            </p>
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className='inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 font-medium disabled:opacity-50'
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className='animate-spin' size={18} /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Start AI Analysis
                </>
              )}
            </button>
            {!project?.documents?.length && (
              <p className='text-xs text-orange-500 mt-4 flex items-center justify-center gap-1'>
                <AlertCircle size={12} /> No documents uploaded yet. AI will use
                project information only.
              </p>
            )}
          </div>
        </div>
      )}

      {(phase === "analyzed" || phase === "chat") && (
        <>
          {analysisResult && (
            <div className='flex-shrink-0 bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3'>
              <div className='flex items-start gap-3'>
                <CheckCircle
                  className='text-blue-500 mt-0.5 flex-shrink-0'
                  size={16}
                />
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-blue-900 mb-1'>
                    Analysis complete |{" "}
                    {analysisResult.keyRequirements?.length || 0} requirements |{" "}
                    {analysisResult.suggestedTasks?.length || 0} suggested tasks
                  </p>
                  <p className='text-xs text-blue-700 line-clamp-2'>
                    {analysisResult.summary}
                  </p>
                </div>
                <button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending}
                  className='flex-shrink-0 text-xs text-blue-600 hover:underline flex items-center gap-1'
                >
                  <Sparkles size={11} /> Re-run analysis
                </button>
              </div>
            </div>
          )}

          <div className='flex-1 overflow-y-auto space-y-4 pr-1 pb-2'>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {msg.role === "assistant" && (
                  <div className='flex-shrink-0 w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center'>
                    <Bot size={16} className='text-sky-700' />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm",
                  )}
                >
                  {msg.content}
                  {msg.tasksCreated && msg.tasksCreated.length > 0 && (
                    <div className='mt-3 pt-3 border-t border-gray-200/50'>
                      <p className='text-xs font-semibold text-green-700 flex items-center gap-1 mb-1.5'>
                        <ListChecks size={12} /> Created tasks:
                      </p>
                      <ul className='space-y-1'>
                        {msg.tasksCreated.map((t) => (
                          <li
                            key={t.id}
                            className='text-xs text-green-700 flex items-center gap-1'
                          >
                            <CheckCircle size={11} /> {t.id} {t.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {msg.agentLogs && msg.agentLogs.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-zinc-150/80 dark:border-zinc-800/40">
                      <details className="group">
                        <summary className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 cursor-pointer select-none font-semibold">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Agent Logs ({msg.agentLogs.reduce((sum, l) => sum + l.duration, 0)}ms)</span>
                          <ChevronDown size={11} className="ml-auto transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-2 pl-3 border-l-2 border-indigo-500/20 space-y-2 max-h-48 overflow-y-auto">
                          {msg.agentLogs.map((log, lIdx) => {
                            const isLlm = log.type === "llm_call";
                            const cleanName = log.name.replace(/\s*\(Lượt\s*\d+\)/gi, "");
                            return (
                              <div key={lIdx} className="text-[11px]">
                                <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 font-semibold">
                                  <span className={cn(isLlm ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-450", "flex items-center gap-1.5")}>
                                    <span>{cleanName}</span>
                                    {isLlm && log.details && (
                                      <span className="text-zinc-400 dark:text-zinc-500 font-normal">
                                        ({log.details.replace("Model: ", "")})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono bg-zinc-100 dark:bg-white/5 px-1 py-0.5 rounded">
                                    {log.duration}ms
                                  </span>
                                </div>
                                {!isLlm && log.details && (
                                  <pre className="mt-1 p-2 rounded-xl bg-zinc-50 dark:bg-black/15 text-[10px] text-zinc-500 dark:text-zinc-500 overflow-x-auto font-mono whitespace-pre-wrap break-all border border-zinc-200/40 dark:border-white/5">
                                    {log.details}
                                  </pre>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className='flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center'>
                    <User size={16} className='text-blue-600' />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className='flex gap-3 justify-start'>
                <div className='flex-shrink-0 w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center'>
                  <Bot size={16} className='text-sky-700' />
                </div>
                <div className='bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm dark:bg-zinc-900 dark:border-white/10'>
                  <Loader2 size={16} className='animate-spin text-sky-500' />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className='flex-shrink-0 mt-3 flex gap-2'>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Example: "Create tasks for the login module", "Create API QA tasks"...'
              rows={2}
              className='flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white dark:bg-zinc-900 dark:border-white/10'
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || chatMutation.isPending}
              className='flex-shrink-0 bg-slate-900 text-white px-4 rounded-xl hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center'
            >
              <Send size={18} />
            </button>
          </div>
          <p className='text-xs text-gray-400 mt-1 text-center'>
            Press Enter to send | Shift+Enter for a new line
          </p>
        </>
      )}
    </div>
  );
}
