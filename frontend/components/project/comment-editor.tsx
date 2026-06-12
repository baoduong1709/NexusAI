"use client";

import { useRef, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapImage from "@tiptap/extension-image";
import { Bold, Italic, Underline, Image as LucideImage } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  sanitizeRichTextHtml,
  uploadAndInsertImage,
  deleteDocument,
  collectImageDocIds,
} from "./description-editor";

export interface CommentEditorProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  projectId: string;
  disabled?: boolean;
}

export function isHtmlEmpty(html: string) {
  if (!html) return true;
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped === "" && !html.includes("<img");
}

export function CommentEditor({
  value,
  onChange,
  onSubmit,
  projectId,
  disabled,
}: CommentEditorProps) {
  const uploadedDocIds = useRef<Set<number>>(new Set());

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
    },
    editorProps: {
      attributes: {
        class: "min-h-[80px] px-3 py-2 text-sm leading-6 text-zinc-900 dark:text-zinc-100 focus:outline-none",
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

  const insertImage = () => {
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
          disabled={isHtmlEmpty(value) || disabled}
          className='rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50'
        >
          Comment
        </button>
      </div>
    </div>
  );
}
