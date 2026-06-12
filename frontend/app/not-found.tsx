import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <div className="text-8xl font-black text-zinc-200 dark:text-zinc-800">
          404
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Page not found
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition-opacity active:scale-95"
        >
          <Home size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
