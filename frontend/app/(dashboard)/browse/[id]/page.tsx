"use client";

import { useParams } from "next/navigation";
import { ProjectDetailView } from "@/components/project/project-detail-view";
import { TaskDetailView } from "@/components/task/task-detail-view";

export default function BrowseDetailPage() {
  const { id } = useParams() as { id: string };

  if (!id) return null;

  // Check if the ID contains a hyphen (task ID format: PROJECTID-SEQUENCE)
  const isTask = id.includes("-");

  if (isTask) {
    return <TaskDetailView />;
  }
  
  return <ProjectDetailView />;
}
