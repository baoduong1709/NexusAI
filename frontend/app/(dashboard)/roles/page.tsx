"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import { useConfirm } from "@/components/providers/confirm-provider";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  X,
  Users,
  FolderKanban,
  ListChecks,
  FileText,
  Bot,
  Lock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Icon mapping for different permission modules
const PERMISSION_ICONS: Record<string, any> = {
  "user:": Users,
  "role:": Shield,
  "project:": FolderKanban,
  "task:": ListChecks,
  "document:": FileText,
  "ai:": Bot,
};

import AccessDenied from "@/components/layout/access-denied";

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.getAll().then((r) => r.data),
    enabled: hasPermission("role:read"), // Only fetch roles if user has permission
  });

  const { data: allPermissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => rolesApi.getPermissions().then((r) => r.data),
    enabled: hasPermission("role:read"), // Only fetch permissions if user has permission
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => rolesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role created successfully");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error creating role"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => rolesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated successfully");
      setShowModal(false);
      setEditRole(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error updating role"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rolesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted successfully");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error deleting role"),
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<any>();

  // Check role:read permission
  if (!hasPermission("role:read")) {
    return <AccessDenied />;
  }

  const selectedPermissions: string[] = watch("permissions") || [];

  const openCreate = () => {
    reset({ name: "", permissions: [] });
    setEditRole(null);
    setShowModal(true);
  };

  const openEdit = (r: any) => {
    reset({ name: r.name, permissions: r.permissions || [] });
    setEditRole(r);
    setShowModal(true);
  };

  const togglePermission = (perm: string) => {
    const curr = watch("permissions") || [];
    if (curr.includes(perm)) {
      setValue(
        "permissions",
        curr.filter((p: string) => p !== perm),
      );
    } else {
      setValue("permissions", [...curr, perm]);
    }
  };

  const onSubmit = (data: any) => {
    if (editRole) updateMutation.mutate({ id: editRole.id, data });
    else createMutation.mutate(data);
  };

  const permGroups = [
    { label: "User Management", prefix: "user:" },
    { label: "Role & Policy", prefix: "role:" },
    { label: "Project Workspace", prefix: "project:" },
    { label: "Task & Backlog", prefix: "task:" },
    { label: "Document Hub", prefix: "document:" },
    { label: "AI Copilot", prefix: "ai:" },
  ];

  // Framer Motion animation configuration
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Page Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Roles & Permissions
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 font-medium">
            Define system roles, access policies, and permission levels for the team
          </p>
        </div>
        {hasPermission("role:create") && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xl shadow-black/5 dark:shadow-black/20 text-sm font-bold"
          >
            <Plus size={16} /> Create Role
          </motion.button>
        )}
      </motion.div>

      {/* Roles Grid */}
      {isLoading ? (
        <motion.div
          variants={itemVariants}
          className="py-24 flex flex-col justify-center items-center gap-3"
        >
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <span className="text-sm text-zinc-500 font-medium">
            Loading authorization rules...
          </span>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {roles.map((r: any) => (
            <motion.div
              key={r.id}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              className="bg-card/80 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-white/5 p-6 shadow-xl shadow-black/5 dark:shadow-black/20 group relative overflow-hidden flex flex-col justify-between min-h-[220px]"
            >
              {/* Dynamic Glow Aura */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 blur-[50px] opacity-50 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">
                      <Shield size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                      {r.name}
                    </h3>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-1">
                    {hasPermission("role:update") && (
                      <button
                        onClick={() => openEdit(r)}
                        className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {hasPermission("role:delete") && (
                      <button
                        onClick={async () => {
                          const isConfirmed = await confirm({
                            title: "Xóa vai trò",
                            message: `Bạn có chắc chắn muốn xóa vai trò "${r.name}" không? Hành động này không thể hoàn tác.`,
                            confirmText: "Xóa",
                            cancelText: "Hủy",
                            variant: "destructive",
                          });
                          if (isConfirmed) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2 max-h-[120px] overflow-y-auto pr-1">
                  {(r.permissions || []).map((p: string) => {
                    const prefix = p.split(":")[0] + ":";
                    const Icon = PERMISSION_ICONS[prefix] || Lock;
                    return (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-500/15"
                      >
                        <Icon size={10} />
                        {p}
                      </span>
                    );
                  })}
                  {(!r.permissions || r.permissions.length === 0) && (
                    <span className="text-xs text-zinc-400 italic">
                      No permissions configured for this role
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold">
                  {(r.permissions || []).length} policies applied
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create / Edit Modal */}
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
                    {editRole ? `Edit Role: ${editRole.name}` : "Create New Role"}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Set the role name and toggle authorization flags
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Role Name *
                  </label>
                  <input
                    {...register("name", { required: true })}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="e.g. Project Manager, Lead Engineer"
                  />
                </div>

                <div className="border-t border-zinc-200 dark:border-white/10 pt-6 mt-6">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block mb-4">
                    Access Control List (ACL)
                  </label>
                  <div className="space-y-5 max-h-[300px] overflow-y-auto pr-2">
                    {permGroups.map((group) => {
                      const perms = allPermissions.filter((p: string) =>
                        p.startsWith(group.prefix)
                      );
                      if (!perms.length) return null;
                      const GroupIcon = PERMISSION_ICONS[group.prefix] || Shield;

                      return (
                        <div key={group.label} className="space-y-2">
                          <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1.5">
                            <GroupIcon size={12} />
                            {group.label}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {perms.map((perm: string) => {
                              const isSelected = selectedPermissions.includes(perm);
                              return (
                                <button
                                  key={perm}
                                  type="button"
                                  onClick={() => togglePermission(perm)}
                                  className={cn(
                                    "text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all duration-200",
                                    isSelected
                                      ? "bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/10"
                                      : "bg-white dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/5 hover:border-indigo-400 dark:hover:border-indigo-400/50"
                                  )}
                                >
                                  {perm}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
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
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-6 py-3 text-sm bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="animate-spin" size={16} />
                    )}
                    {editRole ? "Save Changes" : "Create Role"}
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

