"use client";

import { useAuth } from "@/lib/auth";
import { LogOut, User, Sun, Moon, Bell } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { motion } from "framer-motion";

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="h-20 px-8 flex items-center justify-between sticky top-0 z-40 bg-transparent">
      <div />
      <div className="flex items-center gap-4 bg-white dark:bg-zinc-900/80 dark:bg-card/80 backdrop-blur-xl border border-white/10 dark:border-white/5 px-4 py-2 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20">
        
        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </motion.button>

        {/* Dark/Light mode toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          title="Toggle Theme"
        >
          <div className="transition-transform duration-300">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </div>
        </motion.button>

        <span className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">
              {user?.name}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 dark:text-zinc-500 mt-1">
              {user?.role?.name || "Member"}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm shadow-lg shadow-indigo-500/20 ring-2 ring-white/50 dark:ring-white/10">
            {user?.name ? getInitials(user.name) : <User size={16} />}
          </div>
        </div>
      </div>
    </header>
  );
}
