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

function sanitizeRichTextHtml(input: string) {
  if (!input) return "";
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

function stripHtmlTags(input: string) {
  return input
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type DescriptionEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  onImprove: () => void;
  onAssist: (instruction: string) => void;
  aiMessages: DescriptionAiMessage[];
  assisting: boolean;
  improving: boolean;
  mentionItems: { id: string; label: string }[];
  disabled?: boolean;
  projectId: number;
};

function DescriptionEditor({
  value,
  onChange,
  onBlur,
  onImprove,
  onAssist,
  aiMessages,
  assisting,
  improving,
  mentionItems,
  disabled,
  projectId,
}: DescriptionEditorProps) {
  const [aiInput, setAiInput] = useState("");
  const [selectedMention, setSelectedMention] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [panelToInsert, setPanelToInsert] = useState("");
  const [dateToInsert, setDateToInsert] = useState("");
  const [isTableActive, setIsTableActive] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);


  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      UnderlineExt,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Mention.configure({
        HTMLAttributes: {
          class: "mention-chip",
        },
        renderText({ options, node }) {
          return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
        },
        renderHTML({ options, node }) {
          return [
            "span",
            mergeAttributes(options.HTMLAttributes, {
              "data-mention-id": node.attrs.id,
            }),
            `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`,
          ];
        },
      }),
      TiptapImage.configure({
        HTMLAttributes: {
          class: "editor-image rounded-md max-w-full my-2 border border-zinc-200 dark:border-white/10",
        },
      }),
      InfoPanelNode,
      DateBadgeNode,
      StatusBadgeNode,
      ExpandBlockNode,
      Placeholder.configure({
        placeholder:
          "Add task details, acceptance criteria, or steps to reproduce...",
      }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (editor.isFocused) {
        onChange(sanitizeRichTextHtml(editor.getHTML()));
      }
      setIsTableActive(editor.isActive("table"));
    },
    onSelectionUpdate: ({ editor }) => {
      setIsTableActive(editor.isActive("table"));
    },
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] px-3 py-2 text-sm leading-6 text-zinc-900 dark:text-zinc-100 focus:outline-none",
      },
      handleDOMEvents: {
        paste: (view, event) => {
          const files = Array.from(event.clipboardData?.files || []);
          const items = Array.from(event.clipboardData?.items || []);
          const imageFiles: File[] = [];

          for (const file of files) {
            if (file.type.startsWith("image/")) {
              imageFiles.push(file);
            }
          }

          for (const item of items) {
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (file && !imageFiles.some((f) => f.name === file.name && f.size === file.size)) {
                imageFiles.push(file);
              }
            }
          }

          if (imageFiles.length === 0) return false;
          event.preventDefault();
          for (const file of imageFiles) {
            uploadAndInsertImage(view, projectId, file);
          }
          return true;
        },
        drop: (view, event) => {
          const files = Array.from(event.dataTransfer?.files || []);
          const imageFiles = files.filter((file) => file.type.startsWith("image/"));
          if (imageFiles.length === 0) return false;
          event.preventDefault();
          for (const file of imageFiles) {
            uploadAndInsertImage(view, projectId, file);
          }
          return true;
        },
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const current = sanitizeRichTextHtml(editor.getHTML());
    const next = sanitizeRichTextHtml(value || "");
    if (current !== next) {
      editor.commands.setContent(next || "<p></p>", false);
    }
  }, [editor, value]);

  const runWithFallback = (
    action: (ed: NonNullable<typeof editor>) => boolean,
    fallback?: (ed: NonNullable<typeof editor>) => boolean,
  ) => {
    if (!editor || disabled) return;
    const ok = action(editor);
    if (ok) return;
    editor.chain().focus("end").insertContent("<p></p>").run();
    if (fallback) {
      fallback(editor);
      return;
    }
    action(editor);
  };

  const insertInlineNode = (
    node: { type: string; attrs?: Record<string, string> },
    fallbackText: string,
  ) => {
    runWithFallback(
      (ed) =>
        ed
          .chain()
          .focus()
          .insertContent([node, { type: "text", text: " " }])
          .run(),
      (ed) => ed.chain().focus().insertContent(fallbackText).run(),
    );
  };

  return (
    <div className='mt-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl'>
      <div className='flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-white/5 p-2'>
        <button
          type='button'
          onMouseDown={(e) => e.preventDefault()}
          onClick={onImprove}
          disabled={disabled || improving}
          className='inline-flex items-center gap-1.5 rounded-md border border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 disabled:opacity-50'
        >
          {improving ? (
            <Loader2 size={13} className='animate-spin' />
          ) : (
            <WandSparkles size={13} />
          )}
          Improve description
        </button>
        <span className='mx-1 h-5 w-px bg-gray-200' />
        {[
          {
            icon: Bold,
            active: !!editor?.isActive("bold"),
            action: () => editor?.chain().focus().toggleBold().run(),
          },
          {
            icon: Italic,
            active: !!editor?.isActive("italic"),
            action: () => editor?.chain().focus().toggleItalic().run(),
          },
          {
            icon: Underline,
            active: !!editor?.isActive("underline"),
            action: () => editor?.chain().focus().toggleUnderline().run(),
          },
          {
            icon: List,
            active: !!editor?.isActive("bulletList"),
            action: () => editor?.chain().focus().toggleBulletList().run(),
          },
          {
            icon: ListOrdered,
            active: !!editor?.isActive("orderedList"),
            action: () => editor?.chain().focus().toggleOrderedList().run(),
          },
          {
            icon: Quote,
            active: !!editor?.isActive("blockquote"),
            action: () => editor?.chain().focus().toggleBlockquote().run(),
          },
          {
            icon: Code2,
            active: !!editor?.isActive("codeBlock"),
            action: () => editor?.chain().focus().toggleCodeBlock().run(),
          },
          {
            icon: Undo2,
            active: false,
            action: () => editor?.chain().focus().undo().run(),
          },
          {
            icon: Redo2,
            active: false,
            action: () => editor?.chain().focus().redo().run(),
          },
        ].map((item, idx) => (
          <button
            key={`${idx}`}
            type='button'
            onMouseDown={(e) => {
              e.preventDefault();
              if (disabled) return;
              item.action();
            }}
            disabled={disabled}
            className={cn(
              "rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50",
              item.active && "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400",
            )}
          >
            <item.icon size={14} />
          </button>
        ))}
        <span className='mx-1 h-5 w-px bg-gray-200' />
        <button
          type='button'
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (file && editor) {
                uploadAndInsertImage(editor.view, projectId, file);
              }
            };
            input.click();
          }}
          disabled={disabled}
          className='rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50'
          title='Insert image'
        >
          <LucideImage size={14} />
        </button>
        <button
          type='button'
          onMouseDown={(e) => {
            e.preventDefault();
            runWithFallback((ed) => ed.chain().focus().toggleTaskList().run());
          }}
          disabled={disabled}
          className={cn(
            "rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50",
            editor?.isActive("taskList") && "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400",
          )}
          title='Action item'
        >
          <CheckSquare size={14} />
        </button>
        <button
          type='button'
          onMouseDown={(e) => {
            e.preventDefault();
            runWithFallback((ed) =>
              ed
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run(),
            );
          }}
          disabled={disabled}
          className='rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50'
          title='Insert table'
        >
          <LayoutGrid size={14} />
        </button>
        <button
          type='button'
          onMouseDown={(e) => {
            e.preventDefault();
            runWithFallback((ed) =>
              ed.chain().focus().setHorizontalRule().run(),
            );
          }}
          disabled={disabled}
          className='rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50'
          title='Divider'
        >
          <Minus size={14} />
        </button>
        <select
          value={panelToInsert}
          onChange={(e) => {
            const panelType = e.target.value;
            setPanelToInsert("");
            if (!panelType) return;
            const label =
              panelType === "warning"
                ? "Warning panel"
                : panelType === "success"
                  ? "Success panel"
                  : "Info panel";
            runWithFallback(
              (ed) =>
                ed
                  .chain()
                  .focus()
                  .insertContent({
                    type: "infoPanel",
                    attrs: { panelType },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: label }],
                      },
                    ],
                  })
                  .run(),
              (ed) =>
                ed
                  .chain()
                  .focus()
                  .insertContent(
                    `<p><strong>${panelType.toUpperCase()}:</strong> ...</p>`,
                  )
                  .run(),
            );
          }}
          disabled={disabled}
          className='h-7 bg-transparent rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs text-zinc-700 dark:text-zinc-300'
          title='Info panel'
        >
          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Panel</option>
          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='info'>Info</option>
          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='warning'>Warning</option>
          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='success'>Success</option>
        </select>
        <button
          type='button'
          onMouseDown={(e) => {
            e.preventDefault();
            runWithFallback(
              (ed) =>
                ed
                  .chain()
                  .focus()
                  .insertContent({
                    type: "expandBlock",
                    attrs: {
                      body: "Details content...",
                    },
                  })
                  .run(),
              (ed) =>
                ed
                  .chain()
                  .focus()
                  .insertContent(
                    '<details data-node-type="expand-block" data-summary="Expand" data-body="Details content..."><summary>Expand</summary><div data-expand-body="">Details content...</div></details>',
                  )
                  .run(),
            );
          }}
          disabled={disabled}
          className='rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50'
        >
          <ChevronDown size={14} />
        </button>
        <input
          type='date'
          value={dateToInsert}
          onChange={(e) => {
            const value = e.target.value;
            setDateToInsert("");
            if (!value) return;
            insertInlineNode(
              { type: "dateBadge", attrs: { value } },
              ` <code>Date: ${value}</code> `,
            );
          }}
          disabled={disabled}
          className='h-7 bg-transparent rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs text-zinc-700 dark:text-zinc-300'
          title='Date'
        />
        <input
          type='text'
          value={customStatus}
          onChange={(e) => setCustomStatus(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const value = customStatus.trim();
            if (!value) return;
            setCustomStatus("");
            insertInlineNode(
              { type: "statusBadge", attrs: { value } },
              ` <code>${value}</code> `,
            );
          }}
          disabled={disabled}
          className='h-7 w-24 rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs text-zinc-700 dark:text-zinc-300'
          placeholder='Status'
        />
        <button
          type='button'
          onMouseDown={(e) => {
            e.preventDefault();
            const value = customStatus.trim();
            if (!value) return;
            setCustomStatus("");
            insertInlineNode(
              { type: "statusBadge", attrs: { value } },
              ` <code>${value}</code> `,
            );
          }}
          disabled={disabled}
          className='rounded-md border border-zinc-200 dark:border-white/10 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50'
          title='Insert custom status'
        >
          Add
        </button>
        <select
          value={selectedMention}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedMention("");
            if (!id || disabled) return;
            const member = mentionItems.find((item) => item.id === id);
            if (!member) return;
            insertInlineNode(
              {
                type: "mention",
                attrs: { id: member.id, label: member.label },
              },
              ` @${member.label} `,
            );
          }}
          disabled={disabled}
          className='h-7 bg-transparent rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs text-zinc-700 dark:text-zinc-300'
        >
          <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>@ mention</option>
          {mentionItems.map((item) => (
            <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
      {isTableActive && (
        <div className='relative border-t border-zinc-200 dark:border-white/5 bg-slate-50 px-2 py-2'>
          <button
            type='button'
            onMouseDown={(e) => {
              e.preventDefault();
              if (disabled) return;
              editor?.chain().focus().addColumnAfter().run();
            }}
            disabled={disabled}
            className='absolute left-1/2 top-2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50'
            title='Insert column'
          >
            +
          </button>
          <button
            type='button'
            onMouseDown={(e) => {
              e.preventDefault();
              if (disabled) return;
              editor?.chain().focus().addRowAfter().run();
            }}
            disabled={disabled}
            className='absolute left-2 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50'
            title='Insert row'
          >
            +
          </button>
          <div className='flex items-center gap-2 pl-8'>
            <button
              type='button'
              onMouseDown={(e) => {
                e.preventDefault();
                setShowTableMenu((open) => !open);
              }}
              disabled={disabled}
              className='rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-50'
            >
              Table
            </button>
            <span className='text-xs text-zinc-400 dark:text-zinc-500'>
              Select a cell to edit rows and columns
            </span>
          </div>
          {showTableMenu && (
            <div className='absolute left-8 top-10 z-20 w-52 overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl shadow-lg'>
              {[
                {
                  label: "Add row above",
                  action: () => editor?.chain().focus().addRowBefore().run(),
                },
                {
                  label: "Add row below",
                  action: () => editor?.chain().focus().addRowAfter().run(),
                },
                {
                  label: "Add column before",
                  action: () =>
                    editor?.chain().focus().addColumnBefore().run(),
                },
                {
                  label: "Add column after",
                  action: () => editor?.chain().focus().addColumnAfter().run(),
                },
                {
                  label: "Delete row",
                  action: () => editor?.chain().focus().deleteRow().run(),
                },
                {
                  label: "Delete column",
                  action: () => editor?.chain().focus().deleteColumn().run(),
                },
                {
                  label: "Delete table",
                  action: () => editor?.chain().focus().deleteTable().run(),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type='button'
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (disabled) return;
                    item.action();
                    setShowTableMenu(false);
                  }}
                  disabled={disabled}
                  className='block w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-white/5 disabled:opacity-50'
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className='border-t border-zinc-200 dark:border-white/5 p-2'>
        <div className='max-h-32 space-y-1 overflow-y-auto rounded-md bg-zinc-50 dark:bg-white/5 p-2'>
          {aiMessages.length === 0 ? (
            <p className='text-xs text-zinc-400 dark:text-zinc-500'>
              Ask AI: "thêm acceptance criteria", "viết lại ngắn gọn", "bổ sung
              risks"...
            </p>
          ) : (
            aiMessages.map((msg, idx) => (
              <p
                key={`${msg.role}-${idx}`}
                className={cn(
                  "text-xs",
                  msg.role === "assistant" ? "text-sky-700" : "text-zinc-600 dark:text-zinc-400",
                )}
              >
                <strong>{msg.role === "assistant" ? "AI" : "Bạn"}:</strong>{" "}
                {msg.content}
              </p>
            ))
          )}
        </div>
        <div className='mt-2 flex gap-2'>
          <input
            type='text'
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const instruction = aiInput.trim();
                if (!instruction || disabled || assisting) return;
                onAssist(instruction);
                setAiInput("");
              }
            }}
            placeholder='Nhập yêu cầu cho AI...'
            className='h-8 flex-1 bg-transparent rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-sky-400'
            disabled={disabled || assisting}
          />
          <button
            type='button'
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const instruction = aiInput.trim();
              if (!instruction || disabled || assisting) return;
              onAssist(instruction);
              setAiInput("");
            }}
            disabled={disabled || assisting}
            className='inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50'
          >
            {assisting ? <Loader2 size={12} className='animate-spin' /> : null}
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function isHtmlEmpty(html: string) {
  if (!html) return true;
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped === "" && !html.includes("<img");
}

async function uploadAndInsertImage(view: any, projectId: number, file: File) {
  try {
    let processedFile = file;
    // Check if filename has extension, otherwise determine from mime type
    if (!file.name || !file.name.includes(".")) {
      let ext = ".png";
      if (file.type === "image/jpeg") ext = ".jpg";
      else if (file.type === "image/gif") ext = ".gif";
      else if (file.type === "image/webp") ext = ".webp";
      processedFile = new File([file], `pasted-image-${Date.now()}${ext}`, { type: file.type });
    }

    console.log("Uploading rich text image:", processedFile.name, processedFile.type);
    const res = await documentsApi.upload(projectId, processedFile);
    const filename = res.data.filename;
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
    const imageUrl = `${baseUrl}/uploads/project-${projectId}/${filename}`;

    console.log("Uploaded rich text image URL:", imageUrl);
    const { schema } = view.state;
    const node = schema.nodes.image.create({ src: imageUrl, alt: processedFile.name });
    const transaction = view.state.tr.replaceSelectionWith(node);
    view.dispatch(transaction);
  } catch (error: any) {
    console.error("Failed to upload/insert image:", error);
    toast.error("Failed to upload image: " + (error?.response?.data?.message || error.message || "Unknown error"));
  }
}

type CommentEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  projectId: number;
  disabled?: boolean;
};

function CommentEditor({
  value,
  onChange,
  onSubmit,
  projectId,
  disabled,
}: CommentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      UnderlineExt,
      TiptapImage.configure({
        HTMLAttributes: {
          class: "editor-image rounded-md max-w-full my-2 border border-zinc-200 dark:border-white/10",
        },
      }),
      Placeholder.configure({
        placeholder: "Add a comment...",
      }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (editor.isFocused) {
        onChange(sanitizeRichTextHtml(editor.getHTML()));
      }
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[80px] px-3 py-2 text-sm leading-6 text-zinc-900 dark:text-zinc-100 focus:outline-none",
      },
      handleDOMEvents: {
        paste: (view, event) => {
          const files = Array.from(event.clipboardData?.files || []);
          const items = Array.from(event.clipboardData?.items || []);
          const imageFiles: File[] = [];

          for (const file of files) {
            if (file.type.startsWith("image/")) {
              imageFiles.push(file);
            }
          }

          for (const item of items) {
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (file && !imageFiles.some((f) => f.name === file.name && f.size === file.size)) {
                imageFiles.push(file);
              }
            }
          }

          if (imageFiles.length === 0) return false;
          event.preventDefault();
          for (const file of imageFiles) {
            uploadAndInsertImage(view, projectId, file);
          }
          return true;
        },
        drop: (view, event) => {
          const files = Array.from(event.dataTransfer?.files || []);
          const imageFiles = files.filter((file) => file.type.startsWith("image/"));
          if (imageFiles.length === 0) return false;
          event.preventDefault();
          for (const file of imageFiles) {
            uploadAndInsertImage(view, projectId, file);
          }
          return true;
        },
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const current = sanitizeRichTextHtml(editor.getHTML());
    const next = sanitizeRichTextHtml(value || "");
    if (current !== next) {
      editor.commands.setContent(next || "<p></p>", false);
    }
  }, [editor, value]);

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file && editor) {
        uploadAndInsertImage(editor.view, projectId, file);
      }
    };
    input.click();
  };

  return (
    <div className='mt-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-xl'>
      <div className='flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-white/5 p-1.5'>
        {[
          {
            icon: Bold,
            active: !!editor?.isActive("bold"),
            action: () => editor?.chain().focus().toggleBold().run(),
            title: "Bold",
          },
          {
            icon: Italic,
            active: !!editor?.isActive("italic"),
            action: () => editor?.chain().focus().toggleItalic().run(),
            title: "Italic",
          },
          {
            icon: Underline,
            active: !!editor?.isActive("underline"),
            action: () => editor?.chain().focus().toggleUnderline().run(),
            title: "Underline",
          },
        ].map((item, idx) => (
          <button
            key={`${idx}`}
            type='button'
            onMouseDown={(e) => {
              e.preventDefault();
              if (disabled) return;
              item.action();
            }}
            disabled={disabled}
            className={cn(
              "rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50",
              item.active && "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400",
            )}
            title={item.title}
          >
            <item.icon size={13} />
          </button>
        ))}
        <span className='mx-1 h-4 w-px bg-gray-200' />
        <button
          type='button'
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
            insertImage();
          }}
          disabled={disabled}
          className='rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-gray-800 disabled:opacity-50'
          title='Insert image'
        >
          <LucideImage size={13} />
        </button>
      </div>
      <EditorContent editor={editor} />
      <div className='mt-1.5 flex justify-end border-t border-zinc-100 dark:border-white/5 p-2'>
        <button
          type='button'
          onClick={onSubmit}
          disabled={
            isHtmlEmpty(value) ||
            disabled
          }
          className='rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50'
        >
          Comment
        </button>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { hasPermission, user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("summary");
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
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task created");
      setShowTaskModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: any) =>
      tasksApi.update(projectId, taskId, data),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
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
      qc.invalidateQueries({ queryKey: ["project", projectId] });
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
      qc.invalidateQueries({ queryKey: ["project", projectId] });
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

  const filteredTasks = (project?.tasks || []).filter((task: any) => {
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
      toHours(days) * HOURS_PER_WORK_DAY +
      toHours(hours) +
      toHours(minutes) / 60;
    return Math.round(total * 10000) / 10000;
  }

  function parseDurationInput(value: any) {
    const text = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!text) return 0;

    const tokenPattern = /(\d+(?:\.\d+)?)\s*([dhm])/g;
    let total = 0;
    let match: RegExpExecArray | null;
    while ((match = tokenPattern.exec(text))) {
      const amount = Number(match[1]);
      const unit = match[2];
      if (unit === "d") total += amount * HOURS_PER_WORK_DAY;
      if (unit === "h") total += amount;
      if (unit === "m") total += amount / 60;
    }

    const leftover = text.replace(tokenPattern, "").replace(/\s+/g, "");
    if (leftover) return null;

    return Math.round(total * 10000) / 10000;
  }

  function formatDuration(value: any) {
    const { days, hours, minutes } = durationFromHours(value);
    const parts = [
      days ? `${days}d` : "",
      hours ? `${hours}h` : "",
      minutes ? `${minutes}m` : "",
    ].filter(Boolean);

    return parts.length ? parts.join(" ") : "0m";
  }

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
      qc.invalidateQueries({ queryKey: ["project", projectId] });
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

  const memberIds = new Set(project?.members?.map((m: any) => m.userId));

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

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
  };

  return (
    <div className='space-y-6 max-w-[1400px] mx-auto'>
      {/* Premium Header */}
      <motion.div 
        variants={headerVariants}
        initial="hidden"
        animate="show"
        className='bg-card/80 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-3xl p-6 shadow-xl shadow-black/5 dark:shadow-black/20 relative overflow-hidden'
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] pointer-events-none rounded-full" />
        
        <div className='flex items-start sm:items-center gap-5 relative z-10'>
          <button
            onClick={() => router.push("/projects")}
            className='p-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100/50 hover:bg-zinc-200 dark:bg-zinc-900/95 backdrop-blur-xl/5 dark:hover:bg-zinc-800/95 backdrop-blur-xl/10 rounded-2xl transition-all'
          >
            <ChevronLeft size={22} />
          </button>
          
          <div className='flex-1'>
            <h1 className='text-3xl font-black text-zinc-900 dark:text-white'>{project.name}</h1>
            {project.description && (
              <p className='text-zinc-500 dark:text-zinc-400 text-sm mt-1.5 font-medium max-w-3xl'>
                {project.description}
              </p>
            )}
            
            {/* Stats bar within header */}
            <div className='flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 mt-4'>
              <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/95 backdrop-blur-xl/5 px-2.5 py-1.5 rounded-lg">
                <Users size={14} className="text-emerald-500" /> {project.members?.length} members
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/95 backdrop-blur-xl/5 px-2.5 py-1.5 rounded-lg">
                <FileText size={14} className="text-indigo-500" /> {project.tasks?.length} tasks
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/95 backdrop-blur-xl/5 px-2.5 py-1.5 rounded-lg">
                <LayoutGrid size={14} className="text-amber-500" /> {project.documents?.length} documents
              </span>
              {project.startDate && (
                <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/95 backdrop-blur-xl/5 px-2.5 py-1.5 rounded-lg">
                  <CalendarDays size={14} className="text-blue-500" /> Start: {formatDate(project.startDate)}
                </span>
              )}
            </div>
          </div>
          
          {canProject("project:delete") && (
            <button
              onClick={() =>
                confirm("Delete this project?") && deleteProjectMutation.mutate()
              }
              className='p-3 text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-2xl transition-colors'
              title="Delete Project"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className='flex overflow-x-auto hide-scrollbar border-b border-zinc-200 dark:border-white/10'>
        <div className="flex space-x-1 min-w-max pb-px">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-all relative whitespace-nowrap group",
                tab === key
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
              )}
            >
              <Icon size={16} className={cn("transition-colors", tab === key ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300")} /> 
              {label}
              {tab === key && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {showTaskFilters && (
        <div className='rounded-xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-900/95 backdrop-blur-xl px-3 py-2 shadow-sm'>
          <div className='flex flex-wrap items-center gap-2'>
            <input
              value={taskFilters.search}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder='Search tasks'
              className='h-9 min-w-[220px] flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent dark:bg-zinc-900 px-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <select
              value={taskFilters.status}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, status: e.target.value }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Status</option>
              {workflowStatuses.map((status: string) => (
                <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={taskFilters.priority}
              onChange={(e) =>
                setTaskFilters((prev) => ({
                  ...prev,
                  priority: e.target.value,
                }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Priority</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='HIGH'>HIGH</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='MEDIUM'>MEDIUM</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='LOW'>LOW</option>
            </select>
            <select
              value={taskFilters.epic}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, epic: e.target.value }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Epic</option>
              {allEpics.map((epic: string) => (
                <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={epic} value={epic}>
                  {epic}
                </option>
              ))}
            </select>
            <div className='relative'>
              <button
                type='button'
                onClick={() => setShowLabelFilterMenu((value) => !value)}
                className={cn(
                  "flex h-9 min-w-[116px] items-center justify-between gap-2 rounded-lg border px-3 text-sm",
                  taskFilters.labels.length
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-white/5",
                )}
              >
                <span>
                  {taskFilters.labels.length
                    ? `${taskFilters.labels.length} labels`
                    : "Labels"}
                </span>
                <ChevronDown size={14} />
              </button>
              {showLabelFilterMenu && (
                <div className='absolute left-0 top-10 z-30 w-52 rounded-lg border border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-900/95 backdrop-blur-xl p-2 shadow-lg'>
                  {allLabels.length === 0 ? (
                    <p className='px-2 py-1.5 text-xs text-zinc-400 dark:text-zinc-500'>
                      No labels
                    </p>
                  ) : (
                    allLabels.map((label: string) => (
                      <label
                        key={label}
                        className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-white/5'
                      >
                        <input
                          type='checkbox'
                          checked={taskFilters.labels.includes(label)}
                          onChange={(e) =>
                            setTaskFilters((prev) => ({
                              ...prev,
                              labels: e.target.checked
                                ? [...prev.labels, label]
                                : prev.labels.filter(
                                    (value) => value !== label,
                                  ),
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <select
              value={taskFilters.sprint}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, sprint: e.target.value }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Sprint</option>
              {allSprints.map((sprint) => (
                <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={sprint} value={sprint}>
                  {sprint}
                </option>
              ))}
            </select>
            <select
              value={taskFilters.assigneeId}
              onChange={(e) =>
                setTaskFilters((prev) => ({
                  ...prev,
                  assigneeId: e.target.value,
                }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Assignee</option>
              {project.members?.map((member: any) => (
                <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
            <input
              type='date'
              value={taskFilters.dueFrom}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, dueFrom: e.target.value }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              title='Due from'
            />
            <input
              type='date'
              value={taskFilters.dueTo}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, dueTo: e.target.value }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              title='Due to'
            />
            <select
              value={taskFilters.ai}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, ai: e.target.value }))
              }
              className='h-9 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent px-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value=''>Source</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='ai'>AI generated</option>
              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value='manual'>Manual</option>
            </select>
            <div className='ml-auto flex h-9 items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400'>
              <span className='whitespace-nowrap'>
                {filteredTasks.length}/{project.tasks?.length || 0}
              </span>
              {hasTaskFilters && (
                <button
                  onClick={clearTaskFilters}
                  className='rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5'
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {taskFilters.labels.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {taskFilters.labels.map((label) => (
                <button
                  key={label}
                  onClick={() =>
                    setTaskFilters((prev) => ({
                      ...prev,
                      labels: prev.labels.filter((value) => value !== label),
                    }))
                  }
                  className='rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200'
                >
                  {label} ×
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Backlog Tab */}
      {tab === "backlog" && (
        <div className='space-y-3'>
          <div className='flex items-center justify-between gap-3'>
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
            {canProject("task:create") && (
              <button
                onClick={openCreateTask}
                className='flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm'
              >
                <Plus size={16} /> Add task
              </button>
            )}
          </div>
          {filteredTasks.length === 0 ? (
            <p className='text-center text-zinc-400 dark:text-zinc-500 py-8'>
              {hasTaskFilters ? "No tasks match these filters" : "No tasks yet"}
            </p>
          ) : (
            <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden'>
              <table className='w-full'>
                <thead className='bg-zinc-50 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5'>
                  <tr>
                    {[
                      "ID",
                      "Title",
                      "Assignee",
                      "Priority",
                      "Epic",
                      "Labels",
                      "Sprint",
                      "Est",
                      "Logged",
                      "Deadline",
                      "Status",
                      "AI",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className='px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase'
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {filteredTasks.map((t: any) => (
                    <tr key={t.id} className='hover:bg-zinc-50 dark:bg-white/5'>
                      <td className='px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400'>
                        {t.id}
                      </td>
                      <td className='px-4 py-3'>
                        <p className='font-medium text-zinc-900 dark:text-zinc-100 text-sm'>
                          {t.title}
                        </p>
                        {stripHtmlTags(t.description || "") && (
                          <p className='text-xs text-zinc-400 dark:text-zinc-500 line-clamp-1 mt-0.5'>
                            {stripHtmlTags(t.description)}
                          </p>
                        )}
                      </td>
                      <td className='px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400'>
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
                      <td className='px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400'>
                        {t.epic ? (
                          <span className='rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600'>
                            {t.epic}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className='px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400'>
                        {t.labels?.length ? (
                          <div className='flex flex-wrap gap-1'>
                            {t.labels.map((label: string) => (
                              <span
                                key={label}
                                className='rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600'
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className='px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400'>
                        {t.sprint || "-"}
                      </td>
                      <td className='px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400'>
                        {formatDuration(t.estimateHours)}
                      </td>
                      <td className='px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400'>
                        {formatDuration(t.loggedHours)}
                      </td>
                      <td className='px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400'>
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
                            style={getTaskStatusInlineStyle(
                              t.status,
                              projectWorkflow,
                            )}
                          >
                            {getAllowedTransitionStatuses(
                              projectWorkflow,
                              t.status,
                            ).map((status: string) => (
                              <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className='text-xs px-2.5 py-1 rounded-full font-medium border'
                            style={getTaskStatusInlineStyle(
                              t.status,
                              projectWorkflow,
                            )}
                          >
                            {t.status}
                          </span>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        {t.isAiGenerated && (
                          <span className='text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full'>
                            AI
                          </span>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex gap-1 justify-end'>
                          {canProject("task:update") && (
                            <button
                              onClick={() => openEditTask(t)}
                              className='p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded'
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
                              className='p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded'
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
                  project.documents?.filter(
                    (d: any) => d.originalName !== "requirements.md",
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
        <div className='flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-18rem)]'>
          {workflowStatuses.map((status: string) => {
            const statusTasks =
              filteredTasks.filter((t: any) => t.status === status) || [];
            const isDragOver = dragOverStatus === status;
            return (
              <div
                key={status}
                className='flex-shrink-0 w-72 flex flex-col'
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(status);
                }}
                onDragLeave={(e) => {
                  const relatedTarget = e.relatedTarget;
                  if (
                    !(relatedTarget instanceof globalThis.Node) ||
                    !e.currentTarget.contains(relatedTarget)
                  ) {
                    setDragOverStatus(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStatus(null);
                  if (dragTaskId == null) return;
                  const task = project.tasks?.find(
                    (t: any) => t.id === dragTaskId,
                  );
                  if (
                    task &&
                    task.status !== status &&
                    canProject("task:update")
                  ) {
                    updateStatusMutation.mutate({ taskId: dragTaskId, status });
                  }
                  setDragTaskId(null);
                }}
              >
                <div className='flex items-center gap-2 mb-3'>
                  <span
                    className='text-xs px-2.5 py-1 rounded-full font-medium border'
                    style={getTaskStatusInlineStyle(status, projectWorkflow)}
                  >
                    {status}
                  </span>
                  <span className='text-xs bg-gray-100 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full'>
                    {statusTasks.length}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex-1 space-y-2 rounded-xl p-2 min-h-32 transition-colors",
                    isDragOver
                      ? "bg-blue-50 ring-2 ring-blue-300"
                      : "bg-zinc-50 dark:bg-white/5",
                  )}
                >
                  {statusTasks.map((t: any) => (
                    <div
                      key={t.id}
                      draggable={canProject("task:update")}
                      onDragStart={() => setDragTaskId(t.id)}
                      onDragEnd={() => {
                        setDragTaskId(null);
                        setDragOverStatus(null);
                      }}
                      className={cn(
                        "bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border p-3 shadow-sm transition-all",
                        canProject("task:update")
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-pointer",
                        dragTaskId === t.id
                          ? "opacity-40 scale-95"
                          : "hover:border-blue-200",
                      )}
                      onClick={() =>
                        canProject("task:update") && openEditTask(t)
                      }
                    >
                      <p className='text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1'>
                        {t.title}
                      </p>
                      {stripHtmlTags(t.description || "") && (
                        <p className='text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 mb-2'>
                          {stripHtmlTags(t.description)}
                        </p>
                      )}
                      <div className='flex items-center gap-2 flex-wrap'>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded-full",
                            PRIORITY_COLORS[
                              t.priority as keyof typeof PRIORITY_COLORS
                            ],
                          )}
                        >
                          {t.priority}
                        </span>
                        {t.epic && (
                          <span className='text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full'>
                            {t.epic}
                          </span>
                        )}
                        {t.labels?.map((label: string) => (
                          <span
                            key={label}
                            className='text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full'
                          >
                            {label}
                          </span>
                        ))}
                        {t.sprint && (
                          <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                            #{t.sprint}
                          </span>
                        )}
                        <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                          {formatDuration(t.loggedHours)} /{" "}
                          {formatDuration(t.estimateHours)}
                        </span>
                        {t.assignee && (
                          <span className='text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full ml-auto'>
                            {t.assignee.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {canProject("task:create") && (
                    <button
                      onClick={openCreateTask}
                      className='w-full py-2 text-xs text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-1 bg-white dark:bg-zinc-900/95 backdrop-blur-xl'
                    >
                      <Plus size={12} /> Add task
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
        <div className='flex gap-4 h-[calc(100vh-18rem)]'>
          {/* Left: Requirements + File list */}
          <div className='flex-1 flex flex-col gap-3 overflow-hidden'>
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
                onClick={() => setShowHistory((v) => !v)}
                className='flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 border rounded-lg px-2 py-1'
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
              <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-xl p-3'>
                <p className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2'>
                  Version history
                </p>
                {(reqHistory as any[]).length === 0 ? (
                  <p className='text-xs text-zinc-400 dark:text-zinc-500'>No history yet</p>
                ) : (
                  <div className='space-y-2'>
                    {(reqHistory as any[]).map((h: any) => (
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

            {/* Uploaded files */}
            <div className='flex-shrink-0'>
              <div className='flex items-center justify-between mb-2'>
                <p className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide'>
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
                      ref={uploadInputRef}
                      type='file'
                      className='hidden'
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
                  <p className='text-xs text-zinc-400 dark:text-zinc-500 text-center py-2'>
                    No documents yet
                  </p>
                ) : (
                  project.documents
                    ?.filter((d: any) => d.originalName !== "requirements.md")
                    .map((d: any) => (
                      <div
                        key={d.id}
                        className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-lg px-3 py-2 flex items-center gap-2'
                      >
                        <FileText
                          className='text-blue-400 flex-shrink-0'
                          size={14}
                        />
                        <div className='flex-1 min-w-0'>
                          <p className='text-xs font-medium text-gray-800 truncate dark:text-zinc-200'>
                            {d.originalName}
                          </p>
                          <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                            {(d.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        {canProject("document:delete") && (
                          <button
                            onClick={() =>
                              confirm("Delete?") &&
                              deleteDocMutation.mutate(d.id)
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
        </div>
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
        <div className='space-y-3'>
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
            <div className='space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400'>
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
              <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                Project managers can create and name custom roles for each
                project.
              </p>
            </div>
            {canProject("project:update") && (
              <button
                onClick={openRolesEditor}
                className='self-start px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5'
              >
                Manage roles
              </button>
            )}
          </div>
          {canProject("project:update") && (
            <div>
              <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>
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
                      className='flex items-center gap-2 px-3 py-1.5 border border-dashed border-gray-300 rounded-full text-sm text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 transition-colors'
                    >
                      <Plus size={12} /> {u.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 divide-y divide-gray-50'>
            {project.members?.length === 0 ? (
              <p className='text-center text-zinc-400 dark:text-zinc-500 py-8'>No members yet</p>
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
                    <p className='font-medium text-zinc-900 dark:text-zinc-100 text-sm'>
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
                          className='text-xs bg-transparent dark:text-zinc-100 border border-blue-300 dark:border-blue-500/50 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36'
                        >
                          {projectRoles.map((role: string) => (
                            <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={role} value={role}>
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
                          className='text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-400'
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
                      className='p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded'
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
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm p-6'>
            <h3 className='font-semibold text-zinc-900 dark:text-zinc-100 mb-1'>Add member</h3>
            <p className='text-sm text-zinc-500 dark:text-zinc-400 mb-4'>
              Set the role for{" "}
              <span className='font-medium text-gray-800 dark:text-zinc-200'>
                {addMemberDialog.name}
              </span>{" "}
              in this project.
            </p>
            <div className='space-y-3'>
              <div>
                <label className='text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1'>
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
                  className='w-full bg-transparent text-sm border border-zinc-200 dark:border-white/10 dark:text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400'
                >
                  {projectRoles.map((role: string) => (
                    <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className='flex gap-2 mt-5'>
              <button
                onClick={() => setAddMemberDialog(null)}
                className='flex-1 px-4 py-2 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5'
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
                disabled={updateReqMutation.isPending}
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
                disabled={updateReqMutation.isPending}
                className='inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'
              >
                {updateReqMutation.isPending && (
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
