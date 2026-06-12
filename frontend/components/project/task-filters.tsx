"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  X,
  RotateCcw,
  SlidersHorizontal,
  Calendar,
  Layers,
  Tag,
  Cpu,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

interface TaskFiltersProps {
  filters: {
    search: string;
    status: string;
    priority: string;
    epic: string;
    labels: string[];
    sprint: string;
    assigneeId: string;
    dueFrom: string;
    dueTo: string;
    ai: string;
  };
  setFilters: (updateFn: (prev: any) => any) => void;
  workflowStatuses: string[];
  allEpics: string[];
  allLabels: string[];
  allSprints: string[];
  members: Array<{
    userId: number;
    user: {
      name: string;
    };
  }>;
  clearFilters: () => void;
  hasFilters: boolean;
  filteredCount: number;
  totalCount: number;
}

export function TaskFilters({
  filters,
  setFilters,
  workflowStatuses,
  allEpics,
  allLabels,
  allSprints,
  members,
  clearFilters,
  hasFilters,
  filteredCount,
  totalCount,
}: TaskFiltersProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const statusOptions = [
    { value: "", label: "Status" },
    ...workflowStatuses.map((status) => ({ value: status, label: status }))
  ];

  const priorityOptions = [
    { value: "", label: "Priority" },
    { value: "HIGH", label: "High" },
    { value: "MEDIUM", label: "Medium" },
    { value: "LOW", label: "Low" }
  ];

  const assigneeOptions = [
    { value: "", label: "Assignee" },
    ...(members || []).map((m) => ({ value: m.userId.toString(), label: m.user.name }))
  ];

  const sprintOptions = [
    { value: "", label: "Any Sprint" },
    ...allSprints.map((s) => ({ value: s, label: s }))
  ];

  const epicOptions = [
    { value: "", label: "Any Epic" },
    ...allEpics.map((epic) => ({ value: epic, label: epic }))
  ];

  const aiOptions = [
    { value: "", label: "Any Source" },
    { value: "ai", label: "AI Generated" },
    { value: "manual", label: "Manual Only" }
  ];
  
  const labelMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
      if (labelMenuRef.current && !labelMenuRef.current.contains(event.target as Node)) {
        setShowLabelMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateFilterField = (field: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLabelToggle = (label: string) => {
    setFilters((prev) => {
      const exists = prev.labels.includes(label);
      return {
        ...prev,
        labels: exists
          ? prev.labels.filter((l: string) => l !== label)
          : [...prev.labels, label],
      };
    });
  };

  // Check if any secondary filter is active to show indicator dot
  const hasSecondaryFiltersActive = 
    filters.sprint || 
    filters.epic || 
    filters.labels.length > 0 || 
    filters.dueFrom || 
    filters.dueTo || 
    filters.ai;

  return (
    <div className="bg-white/90 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-white/5 rounded-lg px-2.5 py-1 flex items-center justify-between gap-2 shadow-lg dark:shadow-xl backdrop-blur-xl h-9 relative overflow-visible select-none">
      
      {/* Left: Search & Core Filters */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Search bar */}
        <div className="relative w-48 md:w-60 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
          <input
            value={filters.search}
            onChange={(e) => updateFilterField("search", e.target.value)}
            placeholder="Search ID, title..."
            className="w-full h-7 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-lg pl-8 pr-3 text-[11px] text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
          />
        </div>

        {/* Status Filter */}
        <CustomSelect
          value={filters.status}
          onChange={(val) => updateFilterField("status", val)}
          options={statusOptions}
          placeholder="Status"
        />

        {/* Priority Filter */}
        <CustomSelect
          value={filters.priority}
          onChange={(val) => updateFilterField("priority", val)}
          options={priorityOptions}
          placeholder="Priority"
        />

        {/* Assignee Filter */}
        <CustomSelect
          value={filters.assigneeId}
          onChange={(val) => updateFilterField("assigneeId", val)}
          options={assigneeOptions}
          placeholder="Assignee"
        />
      </div>

      {/* Right: More Filters & Result Count */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* More Filters Dropdown Toggle */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
              hasSecondaryFiltersActive && "border-indigo-500/30 text-indigo-400 bg-indigo-500/5"
            )}
          >
            <SlidersHorizontal size={11} />
            <span>More</span>
            {hasSecondaryFiltersActive && (
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shrink-0" />
            )}
          </button>

          {/* More Filters Dropdown Panel */}
          {showMoreMenu && (
            <div className="absolute right-0 top-8 z-40 w-72 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-2xl space-y-3.5">
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-200/60 dark:border-white/5 pb-1.5">
                Secondary Filters
              </p>

              {/* Sprint Filter */}
              <div className="space-y-1 flex flex-col">
                <label className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                  <Bookmark size={10} /> Sprint
                </label>
                <CustomSelect
                  value={filters.sprint}
                  onChange={(val) => updateFilterField("sprint", val)}
                  options={sprintOptions}
                  placeholder="Any Sprint"
                  className="w-full"
                />
              </div>

              {/* Epic Filter */}
              <div className="space-y-1 flex flex-col">
                <label className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                  <Layers size={10} /> Epic
                </label>
                <CustomSelect
                  value={filters.epic}
                  onChange={(val) => updateFilterField("epic", val)}
                  options={epicOptions}
                  placeholder="Any Epic"
                  className="w-full"
                />
              </div>

              {/* Source/AI Filter */}
              <div className="space-y-1 flex flex-col">
                <label className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                  <Cpu size={10} /> Source
                </label>
                <CustomSelect
                  value={filters.ai}
                  onChange={(val) => updateFilterField("ai", val)}
                  options={aiOptions}
                  placeholder="Any Source"
                  className="w-full"
                />
              </div>

              {/* Labels Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                  <Tag size={10} /> Labels
                </label>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-white/5">
                  {allLabels.length === 0 ? (
                    <span className="text-[10px] text-zinc-600 italic p-1">No labels</span>
                  ) : (
                    allLabels.map((label) => {
                      const isChecked = filters.labels.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleLabelToggle(label)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors border",
                            isChecked
                              ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                              : "bg-transparent text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-white/5 hover:text-zinc-800 dark:hover:text-white"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Due Date Range */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                  <Calendar size={10} /> Due Date Range
                </label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/5">
                  <input
                    type="date"
                    value={filters.dueFrom}
                    onChange={(e) => updateFilterField("dueFrom", e.target.value)}
                    className="bg-transparent border-0 text-zinc-700 dark:text-zinc-300 text-[10px] focus:outline-none w-full cursor-pointer"
                  />
                  <span className="text-zinc-600 text-[10px] px-1">to</span>
                  <input
                    type="date"
                    value={filters.dueTo}
                    onChange={(e) => updateFilterField("dueTo", e.target.value)}
                    className="bg-transparent border-0 text-zinc-700 dark:text-zinc-300 text-[10px] focus:outline-none w-full cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info & Reset */}
        <span className="bg-zinc-100 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-white/5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">
          {filteredCount}/{totalCount}
        </span>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center justify-center text-rose-500 dark:text-rose-400 hover:text-white hover:bg-rose-500 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/10 rounded-lg w-7 h-7 transition-colors active:scale-95 shrink-0"
            title="Clear filters"
          >
            <RotateCcw size={11} />
          </button>
        )}

      </div>

    </div>
  );
}
