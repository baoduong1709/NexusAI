import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background dark:bg-grid-white/[0.02] bg-grid-black/[0.02] overflow-hidden transition-colors duration-500 font-sans">
      {/* Animated Aurora Backgrounds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-[40vw] h-[40vw] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[100px] mix-blend-screen animate-aurora-1" />
        <div className="absolute w-[50vw] h-[50vw] bg-violet-500/10 dark:bg-violet-500/5 rounded-full blur-[120px] mix-blend-screen animate-aurora-2" />
      </div>

      {/* Soft spotlight at the center */}
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_0%,black_80%)] z-0" />

      <div className="relative z-10 w-full flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
