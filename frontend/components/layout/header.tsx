"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { LogOut, User, Sun, Moon, Bell } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { motion, AnimatePresence } from "framer-motion";

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 text-left focus:outline-none cursor-pointer"
          >
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
          </motion.button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <>
                {/* Backdrop to close on click outside */}
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsMenuOpen(false)}
                />
                
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-52 bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-100 dark:border-zinc-800/80 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden"
                >
                  {/* User info for mobile view inside dropdown */}
                  <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/50 sm:hidden">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none truncate">
                      {user?.name}
                    </p>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 dark:text-zinc-500 mt-1">
                      {user?.role?.name || "Member"}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 transition-all text-left font-semibold"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
