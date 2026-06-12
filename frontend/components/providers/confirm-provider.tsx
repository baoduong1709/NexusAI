"use client";

import React, { createContext, useContext, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Info, Trash2, X } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "info";
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

// Custom hook to trigger the confirmation dialog programmatically
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  // Trigger the confirmation dialog and return a promise that resolves on user action
  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const handleClose = (value: boolean) => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(value);
      resolveRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {isOpen && options && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleClose(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Confirm modal container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", duration: 0.25 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            >
              {/* Close button */}
              <button
                onClick={() => handleClose(false)}
                className="absolute right-4 top-4 rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex gap-4">
                {/* Variant-specific visual icon indicator */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  options.variant === "destructive"
                    ? "bg-red-500/10 text-red-500"
                    : options.variant === "warning"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-indigo-500/10 text-indigo-500"
                }`}>
                  {options.variant === "destructive" ? (
                    <Trash2 size={20} />
                  ) : options.variant === "warning" ? (
                    <AlertTriangle size={20} />
                  ) : (
                    <Info size={20} />
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 pr-6">
                    {options.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {options.message}
                  </p>
                </div>
              </div>

              {/* Interaction action buttons */}
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => handleClose(false)}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {options.cancelText || "Hủy"}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors cursor-pointer ${
                    options.variant === "destructive"
                      ? "bg-red-600 hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500"
                      : options.variant === "warning"
                      ? "bg-amber-600 hover:bg-amber-500"
                      : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  {options.confirmText || "Xác nhận"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
