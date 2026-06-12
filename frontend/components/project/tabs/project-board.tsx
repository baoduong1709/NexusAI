"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  PRIORITY_COLORS,
  getTaskStatusInlineStyle,
  stripHtmlTags,
  formatDuration,
  TaskWorkflow,
} from "@/lib/utils";
import { Task } from "@/lib/types";
import { UseMutationResult } from "@tanstack/react-query";

export interface ProjectBoardProps {
  workflowStatuses: string[];
  filteredTasks: Task[];
  dragOverStatus?: string | null;
  setDragOverStatus?: (status: string | null) => void;
  dragTaskId?: string | null;
  setDragTaskId?: (taskId: string | null) => void;
  tasks: Task[];
  canProject: (permission: string) => boolean;
  updateStatusMutation: UseMutationResult<any, any, { taskId: string; status: string }, any>;
  projectWorkflow: TaskWorkflow;
  openEditTask: (task: Task) => void;
  openCreateTask: () => void;
  isLoading?: boolean;
}

export function ProjectBoard({
  workflowStatuses,
  filteredTasks,
  tasks,
  canProject,
  updateStatusMutation,
  projectWorkflow,
  openEditTask,
  openCreateTask,
  isLoading = false,
}: ProjectBoardProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    // If dropped in the same column at the same index, do nothing
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const nextStatus = destination.droppableId;
    const task = tasks?.find((t) => t.id === draggableId);

    if (task && task.status !== nextStatus && canProject("task:update")) {
      updateStatusMutation.mutate({ taskId: draggableId, status: nextStatus });
    }
  };

  // Skeleton Loader during task loading
  if (isLoading) {
    return (
      <div className='flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-18rem)]'>
        {workflowStatuses.map((status: string) => (
          <div key={status} className='flex-shrink-0 w-72 flex flex-col'>
            {/* Column Header Skeleton */}
            <div className='flex items-center gap-2 mb-3 animate-pulse'>
              <div className='h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg' />
              <div className='h-5 w-6 bg-zinc-100 dark:bg-zinc-800 rounded-full' />
            </div>
            {/* Card Skeletons */}
            <div className='flex-1 space-y-2 rounded-xl p-2 min-h-32 bg-zinc-50 dark:bg-white/5'>
              {[1, 2].map((cardIndex) => (
                <div
                  key={cardIndex}
                  className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-4 shadow-sm space-y-3 animate-pulse'
                >
                  <div className='h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6' />
                  <div className='h-3 bg-zinc-150 dark:bg-zinc-850 rounded w-2/3' />
                  <div className='flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5'>
                    <div className='h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded' />
                    <div className='h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800' />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Static shell during SSR / hydration to prevent Mismatch
  if (!isMounted) {
    return (
      <div className='flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-18rem)]'>
        {workflowStatuses.map((status: string) => {
          const statusTasks =
            filteredTasks.filter((t) => t.status === status) || [];
          return (
            <div key={status} className='flex-shrink-0 w-72 flex flex-col'>
              <div className='flex items-center gap-2 mb-3'>
                <span
                  className='text-xs px-2.5 py-1 rounded-full font-medium border'
                  style={getTaskStatusInlineStyle(status, projectWorkflow)}
                >
                  {status}
                </span>
                <span className='text-xs bg-gray-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full'>
                  {statusTasks.length}
                </span>
              </div>
              <div className='flex-1 space-y-2 rounded-xl p-2 min-h-32 bg-zinc-50 dark:bg-white/5'>
                {statusTasks.map((t) => (
                  <div
                    key={t.id}
                    className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border p-3 shadow-sm'
                  >
                    <p className='text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1'>
                      {t.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className='flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-18rem)]'>
        {workflowStatuses.map((status: string) => {
          const statusTasks =
            filteredTasks.filter((t) => t.status === status) || [];
          return (
            <div key={status} className='flex-shrink-0 w-72 flex flex-col'>
              <Droppable droppableId={status} type="task">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 space-y-2 rounded-xl p-2 min-h-32 transition-colors",
                        snapshot.isDraggingOver
                          ? "bg-blue-50/50 ring-2 ring-blue-300 dark:bg-blue-950/10 dark:ring-blue-800"
                          : "bg-zinc-50 dark:bg-white/5",
                      )}
                    >
                      {statusTasks.map((t, index: number) => (
                        <Draggable
                          key={t.id}
                          draggableId={t.id}
                          index={index}
                          isDragDisabled={!canProject("task:update")}
                        >
                          {(providedDrag, snapshotDrag) => (
                            <div
                              ref={providedDrag.innerRef}
                              {...providedDrag.draggableProps}
                              {...providedDrag.dragHandleProps}
                              onClick={() =>
                                canProject("task:update") && openEditTask(t)
                              }
                              className={cn(
                                "bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border p-3 shadow-sm transition-all cursor-grab active:cursor-grabbing",
                                snapshotDrag.isDragging
                                  ? "opacity-90 shadow-lg scale-[1.02] border-blue-300 dark:border-blue-700"
                                  : "hover:border-blue-200 dark:hover:border-blue-800",
                              )}
                            >
                              <p className='text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1'>
                                {t.title}
                              </p>
                              {stripHtmlTags(t.description || "") && (
                                <p className='text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 mb-2'>
                                  {stripHtmlTags(t.description || "")}
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
                                  <span className='text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full'>
                                    {t.epic}
                                  </span>
                                )}
                                {t.labels?.map((label: string) => (
                                  <span
                                    key={label}
                                    className='text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full'
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
                                  <span className='text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full ml-auto'>
                                    {t.assignee.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {canProject("task:create") && (
                        <button
                          onClick={openCreateTask}
                          className='w-full py-2 text-xs text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-1 bg-white dark:bg-zinc-900/95 backdrop-blur-xl'
                        >
                          <Plus size={12} /> Add task
                        </button>
                      )}
                    </div>
                  )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
