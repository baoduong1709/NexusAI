"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  FolderKanban,
  Users,
  FileText,
  ArrowRight,
  Calendar,
  X,
  PlusCircle,
  Trash,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { formatDate, PROJECT_STATUS_COLORS, cn } from "@/lib/utils";
import {
  DEFAULT_PROJECT_ROLES,
  normalizeProjectRoles,
} from "@/lib/project-roles";
import { motion, AnimatePresence } from "framer-motion";
import AccessDenied from "@/components/layout/access-denied";

export default function ProjectsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [projectRoleDraft, setProjectRoleDraft] = useState<string[]>(
    DEFAULT_PROJECT_ROLES,
  );
  const [newProjectRole, setNewProjectRole] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created successfully");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error creating project"),
  });

  const { register, handleSubmit, reset } = useForm<any>();

  const openCreate = () => {
    reset();
    setProjectRoleDraft(DEFAULT_PROJECT_ROLES);
    setNewProjectRole("");
    setShowModal(true);
  };

  const onSubmit = (data: any) =>
    createMutation.mutate({
      ...data,
      projectRoles: normalizeProjectRoles(projectRoleDraft),
    });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemAnim} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">Projects</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 font-medium">
            Manage and track all {projects.length} workspace projects
          </p>
        </div>
        {hasPermission("project:create") && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xl shadow-black/5 dark:shadow-black/20 text-sm font-bold"
          >
            <Plus size={16} /> Create Project
          </motion.button>
        )}
      </motion.div>

      {/* Grid List */}
      {isLoading ? (
        <motion.div variants={container} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <motion.div
              key={i}
              variants={itemAnim}
              className="bg-card/80 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-white/5 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full min-h-[220px] animate-pulse"
            >
              <div>
                <div className="flex items-start justify-between mb-4 gap-4">
                  {/* Name Skeleton */}
                  <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-2/3" />
                  {/* Status Badge Skeleton */}
                  <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-16" />
                </div>
                {/* Description Skeletons */}
                <div className="space-y-2 mb-6">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6" />
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  {/* Members count skeleton */}
                  <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-12" />
                  {/* Tasks count skeleton */}
                  <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-12" />
                </div>
                <div className="flex items-center justify-between">
                  {/* Date skeleton */}
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                  {/* Link skeleton */}
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-10" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : projects.length === 0 ? (
        <motion.div variants={itemAnim} className="text-center py-24 bg-card/80 backdrop-blur-xl border border-zinc-200/80 dark:border-white/5 rounded-3xl shadow-xl">
          <FolderKanban size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">No projects yet</h3>
          <p className="text-sm text-zinc-500 mt-2 mb-8">Create your first project to start tracking tasks.</p>
          {hasPermission("project:create") && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20"
            >
              <Plus size={16} /> Create Project
            </motion.button>
          )}
        </motion.div>
      ) : (
        <motion.div variants={container} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: any) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <motion.div
                variants={itemAnim}
                whileHover={{ scale: 1.02, y: -4 }}
                className="bg-card/80 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-white/5 p-6 shadow-xl shadow-black/5 dark:shadow-black/20 group relative overflow-hidden flex flex-col justify-between h-full min-h-[220px]"
              >
                {/* Glow effect */}
                <div className="absolute -inset-x-2 -bottom-2 h-1/2 bg-gradient-to-t from-indigo-500/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div>
                  <div className="flex items-start justify-between mb-4 gap-2">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white group-hover:text-indigo-500 transition-colors line-clamp-1">
                      {p.name}
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg border flex-shrink-0 backdrop-blur-md",
                        p.status === "ACTIVE" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                        p.status === "COMPLETED" && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                        p.status === "ON_HOLD" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                        p.status === "PLANNING" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                        !["ACTIVE", "COMPLETED", "ON_HOLD", "PLANNING"].includes(p.status) && "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </div>
                
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center gap-3 text-xs text-zinc-500 border-t border-zinc-100 dark:border-white/5 pt-4">
                    <span className="flex items-center gap-1.5 font-semibold bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg">
                      <Users size={14} className="text-emerald-500" /> {p.members?.length || 0}
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg">
                      <FileText size={14} className="text-indigo-500" /> {p._count?.tasks || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} /> {formatDate(p.startDate)}
                    </span>
                    <div className="flex items-center gap-1 text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0">
                      Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#0a0a0a] border border-black/5 dark:border-white/10 rounded-[2rem] shadow-2xl p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-black text-2xl text-zinc-900 dark:text-white">
                    New Project
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">Define your project parameters</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Project Name *
                  </label>
                  <input
                    {...register("name", { required: true })}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="e.g. NexusAI Alpha"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Description
                  </label>
                  <textarea
                    {...register("description")}
                    rows={3}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm resize-none"
                    placeholder="Provide a brief summary..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Start Date
                    </label>
                    <input
                      {...register("startDate")}
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      End Date
                    </label>
                    <input
                      {...register("endDate")}
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Budget (VND)
                  </label>
                  <input
                    {...register("budget", { valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="e.g. 100000000"
                  />
                </div>

                <div className="border-t border-zinc-200 dark:border-white/10 pt-6 mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Project Roles
                      </label>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-2 py-1 rounded-md text-zinc-500">
                      {projectRoleDraft.length} roles
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-2">
                    {projectRoleDraft.map((role, index) => (
                      <div key={`${role}-${index}`} className="flex items-center gap-2">
                        <input
                          value={role}
                          onChange={(e) =>
                            setProjectRoleDraft((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? e.target.value : item,
                              ),
                            )
                          }
                          className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                        />
                        <button
                          type="button"
                          disabled={projectRoleDraft.length === 1}
                          onClick={() =>
                            setProjectRoleDraft((prev) =>
                              prev.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          className="p-2.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl disabled:opacity-40 transition-colors"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      value={newProjectRole}
                      onChange={(e) => setNewProjectRole(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const role = newProjectRole.trim();
                        if (!role) return;
                        setProjectRoleDraft((prev) => [...prev, role]);
                        setNewProjectRole("");
                      }}
                      className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                      placeholder="Add a new role..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const role = newProjectRole.trim();
                        if (!role) return;
                        setProjectRoleDraft((prev) => [...prev, role]);
                        setNewProjectRole("");
                      }}
                      className="px-4 py-2.5 text-sm bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2"
                    >
                      <PlusCircle size={16} /> Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-8 border-t border-zinc-200 dark:border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 text-sm text-zinc-500 font-bold hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-6 py-3 text-sm bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="animate-spin" size={16} />
                    )}
                    Create Project
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
