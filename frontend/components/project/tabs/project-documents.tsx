"use client";

import { BrandLogo } from "@/components/brand-logo";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  History,
  Bot,
  FileText,
  ChevronDown,
  Loader2,
  RefreshCw,
  Upload,
  Trash2,
  Download,
  FileImage,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File,
  CloudUpload,
  Clock,
  FolderOpen,
  Sparkles,
  Info,
  BookOpen,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { aiApi, documentsApi } from "@/lib/api";
import { Document, RequirementsHistory } from "@/lib/types";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/providers/confirm-provider";

export interface ProjectDocumentsProps {
  projectId: string;
  requirements: {
    id: number;
    version: number;
    content: string;
    createdAt: string;
  } | null;
  documents: Document[];
  uploading: boolean;
  docSubTab: "requirements" | "files";
  setDocSubTab: (v: "requirements" | "files") => void;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  reqHistory: RequirementsHistory[];
  previewVersion: RequirementsHistory | null;
  setPreviewVersion: (v: RequirementsHistory | null) => void;
  setShowUpdateRequirementsConfirm: (v: boolean) => void;
  updateReqMutation: any;
  canProject: (permission: string) => boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  deleteProjectDocument: (id: number) => void;
  uploadInputRef: React.RefObject<HTMLInputElement>;
}

// Helper to pick an icon based on file extension / MIME
function getFileIcon(name: string, mime?: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext))
    return { Icon: FileImage, color: "text-pink-500 dark:text-pink-400", bg: "bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-500/10 dark:to-rose-500/5" };
  if (["js", "ts", "tsx", "jsx", "py", "java", "rb", "go", "rs", "c", "cpp", "h", "css", "html", "json", "xml", "yaml", "yml", "toml", "sh", "sql"].includes(ext))
    return { Icon: FileCode, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/5" };
  if (["xls", "xlsx", "csv", "tsv"].includes(ext))
    return { Icon: FileSpreadsheet, color: "text-green-600 dark:text-green-400", bg: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/5" };
  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext))
    return { Icon: FileArchive, color: "text-amber-500 dark:text-amber-400", bg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/5" };
  if (["pdf"].includes(ext))
    return { Icon: FileText, color: "text-red-500 dark:text-red-400", bg: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-500/10 dark:to-rose-500/5" };
  if (["doc", "docx", "txt", "md", "rtf"].includes(ext))
    return { Icon: FileText, color: "text-blue-500 dark:text-blue-400", bg: "bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-500/10 dark:to-sky-500/5" };
  return { Icon: File, color: "text-indigo-500 dark:text-indigo-400", bg: "bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/5" };
}

// Human-readable file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Extract headings from requirements markdown for Table of Contents
function getHeadings(text: string) {
  if (!text) return [];
  const lines = text.split("\n");
  const headingList: { id: string; text: string; level: number }[] = [];

  lines.forEach((line) => {
    const match = line.match(/^(##|###)\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].replace(/[*_`]/g, "").trim();
      const id = rawText
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      headingList.push({ id, text: rawText, level });
    }
  });
  return headingList;
}

export function ProjectDocuments({
  projectId,
  requirements,
  documents,
  uploading,
  docSubTab,
  setDocSubTab,
  showHistory,
  setShowHistory,
  reqHistory,
  previewVersion,
  setPreviewVersion,
  setShowUpdateRequirementsConfirm,
  updateReqMutation,
  canProject,
  handleFileUpload,
  deleteProjectDocument,
  uploadInputRef,
}: ProjectDocumentsProps) {
  const confirm = useConfirm();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Setup scrollspy observer
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || docSubTab !== "requirements") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        root: container,
        rootMargin: "-10px 0px -80% 0px",
      }
    );

    const headingElements = container.querySelectorAll("h2[id], h3[id]");
    headingElements.forEach((el) => observer.observe(el));

    return () => {
      headingElements.forEach((el) => observer.unobserve(el));
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [requirements?.content, docSubTab]);

  const scrollToHeading = (id: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const element = container.querySelector(`[id="${id}"]`);
    if (element) {
      isScrollingRef.current = true;
      setActiveId(id);

      element.scrollIntoView({ behavior: "smooth", block: "start" });

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 800); // Wait for smooth scrolling to complete
    }
  };

  const handleDownload = async (docId: number, originalName: string) => {
    setDownloadingId(docId);
    try {
      const response = await documentsApi.download(projectId, docId);

      // Axios response data is a Blob
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Tải tài liệu thành công");
    } catch (error: any) {
      console.error("Failed to download document:", error);
      toast.error("Không thể tải tài liệu về máy");
    } finally {
      setDownloadingId(null);
    }
  };

  // Drag & drop handlers for the upload zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        // Synthesize a change event for the existing handler
        const dt = new DataTransfer();
        Array.from(e.dataTransfer.files).forEach((f) => dt.items.add(f));
        if (uploadInputRef.current) {
          uploadInputRef.current.files = dt.files;
          uploadInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    },
    [uploadInputRef]
  );

  const filteredDocs = documents?.filter(
    (d) =>
      d.originalName !== "requirements.md" &&
      !d.mimeType?.startsWith("image/")
  );

  const headings = requirements?.content ? getHeadings(requirements.content) : [];

  return (
    <div className='flex flex-col gap-3 h-[calc(100vh-11.5rem)] overflow-hidden'>
      {/* ── Segmented Control Sub-tabs ── */}
      <div className='flex items-center gap-3 pb-1'>
        <div className='flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl'>
          <button
            onClick={() => setDocSubTab("requirements")}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200",
              docSubTab === "requirements"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/60 dark:ring-white/10"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            )}
          >
            <Bot size={13} />
            Requirements
          </button>
          <button
            onClick={() => setDocSubTab("files")}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200",
              docSubTab === "files"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/60 dark:ring-white/10"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            )}
          >
            <FileText size={13} />
            Uploaded Documents
          </button>
        </div>
      </div>

      {/* ── Requirements Tab ── */}
      {docSubTab === "requirements" ? (
        <div className='flex flex-col gap-3 flex-1 overflow-hidden'>
          {/* Header row */}
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-2 flex-1'>
              <BrandLogo size={24} />
              <span className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
                Requirements
              </span>
              {requirements?.version && (
                <span className='text-xs bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full font-medium'>
                  v{requirements.version}
                </span>
              )}
              {requirements?.createdAt && (
                <span className='text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1'>
                  <Clock size={11} />
                  Updated {formatDateTime(requirements.createdAt)}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-all",
                "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300",
                showHistory && "ring-1 ring-indigo-300 dark:ring-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
              )}
            >
              <History size={12} />
              History
              <ChevronDown
                size={11}
                className={cn(
                  "transition-transform duration-200",
                  showHistory && "rotate-180"
                )}
              />
            </button>
            {canProject("ai:analyze") && (
              <button
                onClick={() => setShowUpdateRequirementsConfirm(true)}
                disabled={updateReqMutation.isPending}
                className='flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm disabled:opacity-50 transition-all'
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

          {/* ── Timeline History Panel ── */}
          {showHistory && (
            <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-white/5 rounded-xl p-4 max-h-[300px] overflow-y-auto'>
              <p className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3'>
                Version History
              </p>
              {reqHistory.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-6 text-zinc-400 dark:text-zinc-500'>
                  <History size={28} className='mb-2 opacity-30' />
                  <p className='text-sm font-medium'>No history yet</p>
                  <p className='text-xs mt-0.5'>Version history will appear here after updates</p>
                </div>
              ) : (
                <div className='relative ml-3'>
                  {/* Timeline vertical line */}
                  <div className='absolute left-0 top-2 bottom-2 w-px bg-zinc-200 dark:bg-white/10' />
                  <div className='space-y-0.5'>
                    {reqHistory.map((h, idx) => (
                      <div
                        key={h.id}
                        className='relative pl-6 py-2.5 rounded-lg hover:bg-indigo-50/60 dark:hover:bg-indigo-500/5 transition-colors cursor-pointer group'
                        onClick={() =>
                          aiApi
                            .getVersion(projectId, h.id)
                            .then((r) => setPreviewVersion(r.data))
                        }
                      >
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            "absolute left-[-4px] top-4 w-2 h-2 rounded-full ring-2 ring-white dark:ring-zinc-900 transition-colors",
                            idx === 0
                              ? "bg-indigo-500"
                              : "bg-zinc-300 dark:bg-zinc-600 group-hover:bg-indigo-400"
                          )}
                        />
                        <div className='flex items-center justify-between mb-0.5'>
                          <span className={cn(
                            "text-xs font-semibold",
                            idx === 0
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-zinc-600 dark:text-zinc-300"
                          )}>
                            v{h.version}
                          </span>
                          <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                            {formatDateTime(h.createdAt)}
                          </span>
                        </div>
                        {h.changesSummary ? (
                          <p className='text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-line leading-relaxed'>
                            {h.changesSummary}
                          </p>
                        ) : (
                          <p className='text-xs text-zinc-400 dark:text-zinc-500 italic'>
                            Initial version
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Requirements Markdown Content & TOC ── */}
          <div className="flex-1 flex gap-6 overflow-hidden">
            {/* Left Column: Markdown content */}
            <div
              ref={scrollContainerRef}
              className='flex-1 bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-white/5 rounded-xl overflow-y-auto scroll-smooth select-text'
            >
              {requirements?.content ? (
                <div className='p-8 max-w-4xl mx-auto'>
                  <div className='max-w-none text-sm leading-7 text-zinc-700 dark:text-zinc-300'>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className='mb-6 border-b border-zinc-200 dark:border-white/10 pb-4 text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent select-text'>
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => {
                          const text = React.Children.toArray(children).join("");
                          const id = text
                            .toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, "")
                            .replace(/\s+/g, "-");
                          return (
                            <h2
                              id={id}
                              className='group flex items-center gap-2 mb-4 mt-8 text-lg font-bold text-zinc-900 dark:text-zinc-100 scroll-mt-6 select-text'
                            >
                              <span className="w-1.5 h-5 rounded-full bg-indigo-500 dark:bg-indigo-400 inline-block mr-1" />
                              {children}
                              <a
                                href={`#${id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  scrollToHeading(id);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 transition-opacity ml-1.5"
                              >
                                #
                              </a>
                            </h2>
                          );
                        },
                        h3: ({ children }) => {
                          const text = React.Children.toArray(children).join("");
                          const id = text
                            .toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, "")
                            .replace(/\s+/g, "-");
                          return (
                            <h3
                              id={id}
                              className='group flex items-center gap-2 mb-3 mt-6 text-base font-semibold text-zinc-800 dark:text-zinc-200 scroll-mt-6 select-text'
                            >
                              <span className="w-1 h-3.5 rounded-full bg-zinc-300 dark:bg-zinc-700 inline-block mr-1" />
                              {children}
                              <a
                                href={`#${id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  scrollToHeading(id);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 transition-opacity ml-1.5"
                              >
                                #
                              </a>
                            </h3>
                          );
                        },
                        p: ({ children }) => (
                          <p className='mb-4 text-[14px] text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal select-text'>
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className='mb-4 list-disc space-y-2 pl-6 marker:text-indigo-500 dark:marker:text-indigo-400 select-text'>
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className='mb-4 list-decimal space-y-2 pl-6 marker:text-indigo-500 dark:marker:text-indigo-400 marker:font-semibold select-text'>
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className='pl-1 text-[14px] text-zinc-600 dark:text-zinc-300 leading-relaxed select-text'>
                            {children}
                          </li>
                        ),
                        blockquote: ({ children }) => {
                          const isAiOrMeta = React.Children.toArray(children).some(
                            (child: any) =>
                              typeof child === "string" &&
                              (child.includes("Chưa phân tích") ||
                                child.includes("AI") ||
                                child.includes("Tạo lúc") ||
                                child.includes("Cập nhật"))
                          );

                          return (
                            <div className={cn(
                              "mb-6 flex gap-3 px-5 py-4 text-sm rounded-xl border transition-all duration-300 select-text",
                              isAiOrMeta
                                ? "bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/10 text-indigo-900/90 dark:text-indigo-200/90"
                                : "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-white/5 text-zinc-700 dark:text-zinc-300"
                            )}>
                              <div className="shrink-0 mt-0.5">
                                {isAiOrMeta ? (
                                  <Sparkles size={16} className="text-indigo-500 animate-pulse" />
                                ) : (
                                  <Info size={16} className="text-zinc-400 dark:text-zinc-500" />
                                )}
                              </div>
                              <div className="space-y-1 select-text flex-1">
                                {children}
                              </div>
                            </div>
                          );
                        },
                        table: ({ children }) => (
                          <div className='mb-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/5 shadow-sm'>
                            <table className='min-w-full divide-y divide-zinc-200 dark:divide-white/5 text-left text-xs border-collapse'>
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className='bg-zinc-50/80 dark:bg-zinc-900/60 backdrop-blur-sm border-b border-zinc-200 dark:border-white/5 font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider'>
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className='px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200 text-xs border-r border-zinc-200/40 dark:border-white/5 last:border-r-0'>
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className='border-t border-zinc-200 dark:border-white/5 border-r border-zinc-200/40 dark:border-white/5 last:border-r-0 px-4 py-3 align-top text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50/30 dark:hover:bg-white/5 transition-colors duration-150 select-text'>
                            {children}
                          </td>
                        ),
                        code: ({ children }) => (
                          <code className='rounded-lg bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 text-xs font-mono font-semibold text-zinc-800 dark:text-indigo-300 ring-1 ring-zinc-200 dark:ring-white/5'>
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className='mb-6 overflow-x-auto rounded-xl bg-zinc-950 dark:bg-zinc-950/80 p-5 text-xs leading-relaxed text-zinc-50 ring-1 ring-white/10 shadow-lg font-mono relative group select-text'>
                            {children}
                          </pre>
                        ),
                      }}
                    >
                      {requirements.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 py-12'>
                  <div className='p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 mb-3'>
                    <FileText size={32} className='opacity-50' />
                  </div>
                  <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>No requirements yet</p>
                  <p className='text-xs mt-1 text-zinc-400 dark:text-zinc-500'>
                    Click &quot;Update Requirements&quot; to generate them with AI
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Table of Contents */}
            {requirements?.content && headings.length > 0 && (
              <div className="hidden xl:block w-64 shrink-0 bg-white/50 dark:bg-zinc-900/30 backdrop-blur-sm border border-zinc-200/80 dark:border-white/5 rounded-xl p-4 overflow-y-auto h-full">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200/60 dark:border-white/5">
                  <BookOpen size={14} className="text-indigo-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Mục lục tài liệu
                  </span>
                </div>
                <nav className="space-y-1 text-xs">
                  {headings.map((heading) => (
                    <button
                      key={heading.id}
                      onClick={() => scrollToHeading(heading.id)}
                      className={cn(
                        "w-full text-left py-1.5 px-2 rounded-lg transition-all duration-150 block truncate",
                        heading.level === 3 ? "pl-5 text-zinc-400 dark:text-zinc-500" : "font-semibold",
                        activeId === heading.id
                          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-l-2 border-indigo-500 pl-1.5"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-white/5"
                      )}
                    >
                      {heading.text}
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Files Tab ── */
        <div className='flex flex-col gap-3 flex-1 overflow-hidden'>
          {/* Header */}
          <div className='flex items-center justify-between'>
            <p className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>
              Uploaded documents
            </p>
            {canProject("document:upload") && (
              <label
                className={cn(
                  "flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm cursor-pointer transition-all",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
              >
                {uploading ? (
                  <Loader2 className='animate-spin' size={12} />
                ) : (
                  <Upload size={12} />
                )}
                Upload File
                <input
                  ref={uploadInputRef}
                  type='file'
                  className='hidden'
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Upload drop zone */}
          {canProject("document:upload") && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => uploadInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
                dragOver
                  ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10 dark:border-indigo-500/50"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30",
                uploading && "opacity-50 pointer-events-none"
              )}
            >
              <div className={cn(
                "p-2.5 rounded-xl transition-colors",
                dragOver
                  ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
              )}>
                <CloudUpload size={22} />
              </div>
              <div className='text-center'>
                <p className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>
                  {dragOver ? "Drop files here" : "Drag & drop files here"}
                </p>
                <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-0.5'>
                  or click to browse
                </p>
              </div>
            </div>
          )}

          {/* File cards grid */}
          <div className='flex-1 overflow-y-auto'>
            {(!filteredDocs || filteredDocs.length === 0) ? (
              <div className='flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 py-12'>
                <div className='p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 mb-3'>
                  <FolderOpen size={32} className='opacity-50' />
                </div>
                <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>No documents yet</p>
                <p className='text-xs mt-1 text-zinc-400 dark:text-zinc-500'>Upload files to keep them with the project</p>
              </div>
            ) : (
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1'>
                {filteredDocs.map((d) => {
                  const { Icon, color, bg } = getFileIcon(d.originalName, d.mimeType);
                  return (
                    <div
                      key={d.id}
                      className='group bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/80 dark:border-white/5 rounded-xl p-4 hover:border-zinc-300/90 dark:hover:border-white/10 hover:shadow-md hover:scale-[1.01] transition-all duration-300 relative overflow-hidden'
                    >
                      {/* Action buttons – visible on hover */}
                      <div className='absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10'>
                        <button
                          onClick={() => handleDownload(d.id, d.originalName)}
                          disabled={downloadingId === d.id}
                          className='p-1.5 rounded-lg bg-white/95 dark:bg-zinc-800/90 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 transition-all border border-zinc-200/50 dark:border-white/5 shadow-sm'
                          title='Download'
                        >
                          {downloadingId === d.id ? (
                            <Loader2 size={13} className='animate-spin' />
                          ) : (
                            <Download size={13} />
                          )}
                        </button>
                        {canProject("document:delete") && (
                          <button
                            onClick={async () => {
                              const isConfirmed = await confirm({
                                title: "Xóa tài liệu",
                                message: `Bạn có chắc chắn muốn xóa tài liệu "${d.originalName}" không? Hành động này không thể hoàn tác.`,
                                confirmText: "Xóa",
                                cancelText: "Hủy",
                                variant: "destructive",
                              });
                              if (isConfirmed) {
                                deleteProjectDocument(d.id);
                              }
                            }}
                            className='p-1.5 rounded-lg bg-white/95 dark:bg-zinc-800/90 hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-all border border-zinc-200/50 dark:border-white/5 shadow-sm'
                            title='Delete'
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-start gap-3">
                        {/* File icon with subtle glow */}
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-black/5 dark:border-white/5", bg)}>
                          <Icon size={18} className={color} />
                        </div>

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <p
                            className='text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate pr-6 group-hover:pr-10 transition-all duration-200'
                            title={d.originalName}
                          >
                            {d.originalName}
                          </p>

                          {/* Metadata */}
                          <div className='flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium'>
                            <span>{formatFileSize(d.size)}</span>
                            <span>·</span>
                            <span className="truncate">{formatDateTime(d.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
