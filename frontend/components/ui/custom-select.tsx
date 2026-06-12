"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Interface representing a single select option
export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

// Props for the CustomSelect component
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
  buttonClassName,
  align = "left",
  size = "sm",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside of the component bounds
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", isOpen && "z-50", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-zinc-200 bg-white/80 text-zinc-700 dark:border-white/5 dark:bg-zinc-900/60 dark:text-zinc-300 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer select-none text-[11px] font-medium outline-none",
          size === "sm" ? "h-7 px-2.5" : "h-9 px-3.5",
          isOpen && "border-indigo-500 ring-1 ring-indigo-500/20",
          buttonClassName
        )}
      >
        <span className="truncate flex items-center gap-1.5 pr-2">
          {selectedOption ? (
            <>
              {selectedOption.icon}
              {selectedOption.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          size={size === "sm" ? 10 : 12}
          className={cn("text-zinc-500 transition-transform duration-200 shrink-0", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className={cn(
              "absolute z-[90] mt-1 max-h-60 min-w-[140px] w-full overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/95 p-1 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/95 focus:outline-none scrollbar-none",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white cursor-pointer",
                    isSelected && "bg-zinc-50 text-indigo-600 dark:bg-zinc-900 dark:text-indigo-400"
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {option.icon}
                    {option.label}
                  </span>
                  {isSelected && <Check size={10} className="shrink-0 text-indigo-500" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
