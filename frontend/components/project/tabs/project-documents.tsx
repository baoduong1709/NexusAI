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
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { aiApi } from "@/lib/api";
import { Document, RequirementsHistory } from "@/lib/types";

export interface ProjectDocumentsProps {
  projectId: number;
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
  return (
    <div className='flex flex-col gap-3 h-[calc(100vh-18rem)] overflow-hidden'>
      {/* Sub-tabs Switcher */}
      <div className='flex items-center border-b border-zinc-200 dark:border-white/10 pb-2 mb-1'>
        <div className='flex space-x-1 bg-zinc-100 dark:bg-white/5 p-1 rounded-xl'>
          <button
            onClick={() => setDocSubTab("requirements")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all",
              docSubTab === "requirements"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            <Bot size={13} />
            Requirements
          </button>
          <button
            onClick={() => setDocSubTab("files")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all",
              docSubTab === "files"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            <FileText size={13} />
            Uploaded Documents
          </button>
        </div>
      </div>

      {/* Conditional Sub-tab rendering */}
      {docSubTab === "requirements" ? (
        <div className='flex flex-col gap-3 flex-1 overflow-hidden'>
          {/* Requirements header */}
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-2 flex-1'>
              <BrandLogo size={24} />
              <span className='font-semibold text-gray-800 text-sm dark:text-zinc-200'>
                Requirements
              </span>
              {requirements?.version && (
                <span className='text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full'>
                  v{requirements.version}
                </span>
              )}
              {requirements?.createdAt && (
                <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                  Updated {formatDateTime(requirements.createdAt)}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className='flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 border rounded-lg px-2 py-1'
            >
              <History size={12} /> History{" "}
              <ChevronDown
                size={11}
                className={cn(
                  "transition-transform",
                  showHistory && "rotate-180"
                )}
              />
            </button>
            {canProject("ai:analyze") && (
              <button
                onClick={() => setShowUpdateRequirementsConfirm(true)}
                disabled={updateReqMutation.isPending}
                className='flex items-center gap-1.5 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50'
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
            <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-xl p-3 max-h-[300px] overflow-y-auto'>
              <p className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2'>
                Version history
              </p>
              {reqHistory.length === 0 ? (
                <p className='text-xs text-zinc-400 dark:text-zinc-500'>No history yet</p>
              ) : (
                <div className='space-y-2'>
                  {reqHistory.map((h) => (
                    <div
                      key={h.id}
                      className='border border-zinc-200 dark:border-white/5 rounded-lg p-2 hover:border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer'
                      onClick={() =>
                        aiApi
                          .getVersion(projectId, h.id)
                          .then((r) => setPreviewVersion(r.data))
                      }
                    >
                      <div className='flex items-center justify-between mb-1'>
                        <span className='text-xs font-semibold text-sky-700'>
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
              )}
            </div>
          )}

          {/* Requirements content */}
          <div className='flex-1 bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-xl p-4 overflow-y-auto'>
            {requirements?.content ? (
              <div className='max-w-none text-sm leading-6 text-zinc-700 dark:text-zinc-300'>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className='mb-4 border-b border-zinc-200 dark:border-white/5 pb-3 text-xl font-semibold text-gray-950 dark:text-zinc-50'>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className='mb-2 mt-5 text-base font-semibold text-zinc-900 dark:text-zinc-100'>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className='mb-2 mt-4 text-sm font-semibold text-gray-800 dark:text-zinc-200'>
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className='mb-3 text-sm text-zinc-700 dark:text-zinc-300'>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className='mb-3 list-disc space-y-1 pl-5'>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className='mb-3 list-decimal space-y-1 pl-5'>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className='pl-1 text-sm text-zinc-700 dark:text-zinc-300'>
                        {children}
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className='mb-3 border-l-4 border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300'>
                        {children}
                      </blockquote>
                    ),
                    table: ({ children }) => (
                      <div className='mb-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/5'>
                        <table className='min-w-full divide-y divide-gray-100 dark:divide-white/5 text-left text-xs'>
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className='bg-zinc-50 dark:bg-white/5'>{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className='px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300'>
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className='border-t border-zinc-200 dark:border-white/5 px-3 py-2 align-top text-zinc-700 dark:text-zinc-300'>
                        {children}
                      </td>
                    ),
                    code: ({ children }) => (
                      <code className='rounded bg-gray-100 dark:bg-white/10 px-1 py-0.5 text-xs text-gray-800 dark:text-zinc-200'>
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className='mb-4 overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs leading-relaxed text-gray-50'>
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {requirements.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500'>
                <FileText size={32} className='mb-2 opacity-40' />
                <p className='text-sm'>No requirements yet</p>
                <p className='text-xs mt-1'>
                  Click "Update Requirements" to generate them with AI
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className='flex flex-col gap-3 flex-1 overflow-hidden'>
          <div className='flex items-center justify-between mb-2'>
            <p className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide'>
              Uploaded documents
            </p>
            {canProject("document:upload") && (
              <label
                className={cn(
                  "flex items-center gap-1.5 text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 cursor-pointer",
                  uploading && "opacity-50"
                )}
              >
                {uploading ? (
                  <Loader2 className='animate-spin' size={12} />
                ) : (
                  <Upload size={12} />
                )}
                Upload
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
          <div className='flex-1 bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-xl p-4 overflow-y-auto space-y-1.5'>
            {documents?.filter(
              (d) =>
                d.originalName !== "requirements.md" &&
                !d.mimeType?.startsWith("image/")
            ).length === 0 ? (
              <div className='flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 py-12'>
                <FileText size={32} className='mb-2 opacity-40' />
                <p className='text-sm font-semibold'>No documents yet</p>
                <p className='text-xs mt-1'>Upload files to keep them with the project</p>
              </div>
            ) : (
              documents
                ?.filter(
                  (d) =>
                    d.originalName !== "requirements.md" &&
                    !d.mimeType?.startsWith("image/")
                )
                .map((d) => (
                  <div
                    key={d.id}
                    className='bg-zinc-50/50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-zinc-100/50 dark:hover:bg-white/[0.04] transition-colors'
                  >
                    <div className='p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-lg flex-shrink-0'>
                      <FileText size={20} />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate' title={d.originalName}>
                        {d.originalName}
                      </p>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-0.5'>
                        {(d.size / 1024).toFixed(1)} KB • Uploaded by {d.uploadedBy?.name || "System"} on {formatDateTime(d.createdAt)}
                      </p>
                    </div>
                    <div className='flex items-center gap-1.5'>
                      <a
                        href={d.url}
                        target='_blank'
                        rel='noreferrer'
                        className='p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-white/5'
                        title='Download'
                      >
                        <FileText size={16} />
                      </a>
                      {canProject("document:delete") && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete document ${d.originalName}?`)) {
                              deleteProjectDocument(d.id);
                            }
                          }}
                          className='p-1.5 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 rounded hover:bg-zinc-100 dark:hover:bg-white/5'
                          title='Delete'
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
