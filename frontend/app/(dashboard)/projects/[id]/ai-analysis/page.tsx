"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi, projectsApi } from "@/lib/api";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import {
  BrainCircuit,
  Loader2,
  ChevronLeft,
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tasksCreated?: { id: number; title: string }[];
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

  const chatMutation = useMutation({
    mutationFn: (userMsg: string) => {
      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: userMsg },
      ];
      return aiApi
        .chat(
          projectId,
          newMessages.map((m) => ({ role: m.role, content: m.content })),
        )
        .then((r) => ({ userMsg, data: r.data }));
    },
    onSuccess: ({ userMsg, data }) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMsg },
        {
          role: "assistant",
          content: data.message,
          tasksCreated: data.tasksCreated,
        },
      ]);
      if (data.tasksCreated?.length) {
        qc.invalidateQueries({ queryKey: ["project", projectId] });
        toast.success(`${data.tasksCreated.length} tasks created`);
      }
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to send message"),
  });

  const sendMessage = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const msg = input.trim();
    setInput("");
    chatMutation.mutate(msg);
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
          <div className='bg-purple-100 p-2 rounded-lg'>
            <BrainCircuit className='text-purple-600' size={20} />
          </div>
          <div>
            <h1 className='text-xl font-bold text-gray-900'>AI Assistant</h1>
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
            <BrainCircuit className='text-purple-400 mx-auto mb-4' size={52} />
            <h2 className='text-lg font-semibold text-gray-800 mb-2'>
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
              className='inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 font-medium disabled:opacity-50'
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
                  <div className='flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center'>
                    <Bot size={16} className='text-purple-600' />
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
                            <CheckCircle size={11} /> {t.title}
                          </li>
                        ))}
                      </ul>
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
                <div className='flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center'>
                  <Bot size={16} className='text-purple-600' />
                </div>
                <div className='bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm'>
                  <Loader2 size={16} className='animate-spin text-purple-400' />
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
              className='flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white'
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || chatMutation.isPending}
              className='flex-shrink-0 bg-purple-600 text-white px-4 rounded-xl hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center'
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
