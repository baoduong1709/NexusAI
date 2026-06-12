"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="text-red-500" size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition-opacity active:scale-95"
        >
          <RotateCcw size={16} />
          Try again
        </button>
      </div>
    </div>
  );
}
