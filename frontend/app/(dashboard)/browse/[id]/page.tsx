"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function BrowseDispatcherPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  useEffect(() => {
    if (!id) return;

    // Check if the ID contains a hyphen (task ID format: PROJECTID-SEQUENCE)
    const isTask = id.includes("-");

    if (isTask) {
      router.replace(`/tasks/${id}`);
    } else {
      router.replace(`/projects/${id}`);
    }
  }, [id, router]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative flex items-center justify-center">
        {/* Decorative loading circles */}
        <div className="absolute w-16 h-16 rounded-full border-4 border-indigo-500/20 animate-ping pointer-events-none" />
        <Loader2 className="animate-spin text-indigo-500 relative z-10" size={36} />
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Routing to workspace
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
          Identifying resource ID: <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">{id}</span>...
        </p>
      </div>
    </div>
  );
}
