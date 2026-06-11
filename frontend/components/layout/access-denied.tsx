"use client";

import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";

export default function AccessDenied() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-card/80 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-transparent blur-[50px] pointer-events-none rounded-full" />

        <div className="mx-auto bg-red-500/10 text-red-500 dark:text-red-400 p-4 rounded-2xl w-16 h-16 flex items-center justify-center mb-6 ring-1 ring-red-500/20">
          <ShieldAlert size={32} />
        </div>

        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">
          Access Denied
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 font-medium">
          Bạn không có quyền truy cập hoặc thực hiện thao tác trên trang này. Vui lòng liên hệ quản trị viên để biết thêm chi tiết.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/projects")}
            className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-lg text-sm font-bold"
          >
            <ArrowLeft size={16} /> Quay lại Dự án
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={logout}
            className="flex items-center justify-center gap-2 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 px-6 py-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors text-sm font-bold"
          >
            <LogOut size={16} /> Đăng xuất
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
