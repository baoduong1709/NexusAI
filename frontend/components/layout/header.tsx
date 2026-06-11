"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { LogOut, User, Sun, Moon, Bell, Key, Copy, Check, Eye, EyeOff } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import { authApi } from "@/lib/api";

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [personalToken, setPersonalToken] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiresIn, setExpiresIn] = useState("365d");

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleOpenTokenModal = () => {
    setIsTokenModalOpen(true);
    setPersonalToken("");
    setIsCopied(false);
    setIsTokenVisible(false);
    setExpiresIn("365d");
  };

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      const res = await authApi.generatePersonalToken(expiresIn);
      setPersonalToken(res.data.token);
      setIsCopied(false);
    } catch (error) {
      console.error("Failed to generate token", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(personalToken);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
              <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 dark:text-zinc-550 mt-1">
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
                  className="absolute right-0 top-[calc(100%+8px)] w-52 bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-100 dark:border-zinc-800/80 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden"
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
                      handleOpenTokenModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left font-semibold cursor-pointer"
                  >
                    <Key size={16} />
                    <span>API Token (MCP)</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 transition-all text-left font-semibold cursor-pointer border-t border-zinc-100 dark:border-zinc-800/50"
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

      {/* Personal Access Token Modal */}
      <AnimatePresence>
        {isTokenModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTokenModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative z-10 overflow-hidden font-sans"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-500/10 dark:bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-550">
                    Personal API Token (MCP)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Dùng để cấu hình AI local (Cursor, Claude Desktop...)
                  </p>
                </div>
              </div>

              <div className="space-y-4 my-5">
                <p className="text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed">
                  Token này cấp quyền truy cập API của NexusAI dưới danh nghĩa tài khoản của bạn. Vui lòng bảo mật kỹ token này.
                </p>

                {personalToken ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                      Token của bạn
                    </label>
                    <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 gap-2">
                      <input
                        type={isTokenVisible ? "text" : "password"}
                        value={personalToken}
                        readOnly
                        className="bg-transparent border-none outline-none flex-1 text-xs text-zinc-800 dark:text-zinc-100 font-mono select-all pr-16"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        <button
                          onClick={() => setIsTokenVisible(!isTokenVisible)}
                          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
                          title={isTokenVisible ? "Ẩn token" : "Hiện token"}
                        >
                          {isTokenVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={handleCopyToken}
                          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors flex items-center justify-center cursor-pointer"
                          title="Sao chép token"
                        >
                          {isCopied ? <Check size={14} className="text-emerald-500 animate-scale-in" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4 px-6 flex flex-col border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20">
                    <div className="w-full space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                        Chọn thời gian hiệu lực
                      </label>
                      <select
                        value={expiresIn}
                        onChange={(e) => setExpiresIn(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-250 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        <option value="7d">7 ngày (Ngắn hạn)</option>
                        <option value="30d">30 ngày</option>
                        <option value="90d">90 ngày</option>
                        <option value="365d">1 năm (Mặc định)</option>
                        <option value="never">Vô hạn (Không hết hạn)</option>
                      </select>
                    </div>

                    <div className="flex justify-center pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGenerateToken}
                        disabled={isGenerating}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isGenerating ? "Đang tạo..." : "Tạo Token Mới"}
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  onClick={() => setIsTokenModalOpen(false)}
                  className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 text-sm font-semibold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
