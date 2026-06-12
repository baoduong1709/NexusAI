"use client";

import { useState, useRef, useEffect } from "react";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  NodeViewProps,
  Editor,
} from "@tiptap/react";
import { EditorView } from "@tiptap/pm/view";
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
import {
  Image as LucideImage,
  Loader2,
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
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { documentsApi } from "@/lib/api";
import { toast } from "sonner";

export interface DescriptionAiMessage {
  role: "user" | "assistant";
  content: string;
}

// ---- Custom Tiptap Nodes ----

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

function ExpandBlockView({ node, updateAttributes }: NodeViewProps) {
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

// ---- Helper Functions ----

export function sanitizeRichTextHtml(input: string) {
  if (!input) return "";
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

export function collectImageDocIds(html: string): number[] {
  if (!html) return [];
  const ids: number[] = [];
  const regex = /<img[^>]+title="doc:(\d+)"[^>]*>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    ids.push(parseInt(match[1], 10));
  }
  return ids;
}

export async function deleteDocument(projectId: string, docId: number) {
  try {
    await documentsApi.delete(projectId, docId);
  } catch (e: any) {
    if (e?.response?.status !== 404) {
      console.error(`Failed to clean up image document ${docId}:`, e);
    }
  }
}

export async function uploadAndInsertImage(
  view: EditorView,
  projectId: string,
  file: File,
  onDocId?: (docId: number) => void,
) {
  try {
    let processedFile = file;
    if (!file.name || !file.name.includes(".")) {
      let ext = ".png";
      if (file.type === "image/jpeg") ext = ".jpg";
      else if (file.type === "image/gif") ext = ".gif";
      else if (file.type === "image/webp") ext = ".webp";
      processedFile = new File([file], `pasted-image-${Date.now()}${ext}`, { type: file.type });
    }

    const res = await documentsApi.upload(projectId, processedFile);
    const docId = res.data.id as number;
    const filename = res.data.filename;
    const imageUrl = res.data.url || `${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api$/, "")}/uploads/project-${projectId}/${filename}`;

    const { schema } = view.state;
    const node = schema.nodes.image.create({
      src: imageUrl,
      alt: processedFile.name,
      title: `doc:${docId}`,
    });
    const transaction = view.state.tr.replaceSelectionWith(node);
    view.dispatch(transaction);
    onDocId?.(docId);
  } catch (error: any) {
    console.error("Failed to upload/insert image:", error);
    toast.error("Failed to upload image: " + (error?.response?.data?.message || error.message || "Unknown error"));
  }
}

// ---- Main Component ----

export type DescriptionEditorProps = {
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
  projectId: string;
};

export function DescriptionEditor({
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

  const uploadedDocIds = useRef<Set<number>>(new Set());

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
        placeholder: "Add task details, acceptance criteria, or steps to reproduce...",
      }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (editor.isFocused) {
        const html = sanitizeRichTextHtml(editor.getHTML());
        onChange(html);

        const currentIds = new Set(collectImageDocIds(html));
        uploadedDocIds.current.forEach((docId) => {
          if (!currentIds.has(docId)) {
            uploadedDocIds.current.delete(docId);
            deleteDocument(projectId, docId);
          }
        });
      }
      setIsTableActive(editor.isActive("table"));
    },
    onSelectionUpdate: ({ editor }) => {
      setIsTableActive(editor.isActive("table"));
    },
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: {
        class: "min-h-[180px] px-3 py-2 text-sm leading-6 text-zinc-900 dark:text-zinc-100 focus:outline-none",
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
            uploadAndInsertImage(view, projectId, file, (docId) => {
              uploadedDocIds.current.add(docId);
            });
          }
          return true;
        },
        drop: (view, event) => {
          const files = Array.from(event.dataTransfer?.files || []);
          const imageFiles = files.filter((file) => file.type.startsWith("image/"));
          if (imageFiles.length === 0) return false;
          event.preventDefault();
          for (const file of imageFiles) {
            uploadAndInsertImage(view, projectId, file, (docId) => {
              uploadedDocIds.current.add(docId);
            });
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
    return () => {
      if (!editor) return;
      const html = editor.getHTML();
      const currentIds = new Set(collectImageDocIds(html));
      uploadedDocIds.current.forEach((docId) => {
        if (!currentIds.has(docId)) {
          deleteDocument(projectId, docId);
        }
      });
    };
  }, [projectId, editor]);

  useEffect(() => {
    if (!editor) return;
    const current = sanitizeRichTextHtml(editor.getHTML());
    const next = sanitizeRichTextHtml(value || "");
    if (current !== next) {
      uploadedDocIds.current = new Set(collectImageDocIds(next));
      editor.commands.setContent(next || "<p></p>", false);
    }
  }, [editor, value]);

  const runWithFallback = (
    action: (ed: Editor) => boolean,
    fallback?: (ed: Editor) => boolean,
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
                uploadAndInsertImage(editor.view, projectId, file, (docId) => {
                  uploadedDocIds.current.add(docId);
                });
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
