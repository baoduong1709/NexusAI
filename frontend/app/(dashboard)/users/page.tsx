"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, rolesApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Search, X, Mail, ShieldAlert, Award, Power } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { getInitials, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll().then((r) => r.data),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created successfully");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error creating user"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => usersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      setShowModal(false);
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error updating user"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted successfully");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error deleting user"),
  });

  const { register, handleSubmit, reset } = useForm<any>();

  const openCreate = () => {
    reset({ name: "", email: "", password: "", roleId: "", skills: "" });
    setEditUser(null);
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    reset({
      name: u.name,
      email: u.email,
      roleId: u.role?.id || "",
      skills: u.skills?.join(", ") || "",
      isActive: u.isActive,
    });
    setEditUser(u);
    setShowModal(true);
  };

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      roleId: data.roleId ? Number(data.roleId) : undefined,
      skills: data.skills
        ? data.skills
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
    };
    if (editUser) {
      if (!payload.password) delete payload.password;
      updateMutation.mutate({ id: editUser.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = users.filter(
    (u: any) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  // Framer Motion animations
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
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Users & Members
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 font-medium">
            Manage user accounts, system roles, and specialized skill tags
          </p>
        </div>
        {hasPermission("user:create") && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xl shadow-black/5 dark:shadow-black/20 text-sm font-bold"
          >
            <Plus size={16} /> Add User
          </motion.button>
        )}
      </motion.div>

      {/* Search Bar */}
      <motion.div variants={itemVariants} className="relative">
        <Search className="absolute left-4 top-3.5 text-zinc-400 dark:text-zinc-500" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-12 pr-4 py-3.5 bg-card/85 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/30 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-all shadow-lg shadow-black/5"
        />
      </motion.div>

      {/* Table Section */}
      <motion.div
        variants={itemVariants}
        className="bg-card/80 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-3xl shadow-xl overflow-hidden relative z-10"
      >
        {isLoading ? (
          <div className="py-24 flex flex-col justify-center items-center gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className="text-sm text-zinc-500 font-medium">Loading organization directory...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                  {["User Profile", "Email Address", "System Role", "Specialized Skills", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {filtered.map((u: any) => (
                  <tr
                    key={u.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* User Profile */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm shadow-md shadow-indigo-500/20 ring-2 ring-white/50 dark:ring-white/5">
                          {getInitials(u.name)}
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">
                          {u.name}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Mail size={14} className="text-zinc-400" />
                        {u.email}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.role ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-indigo-500/10">
                          {u.role.name}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600 text-xs italic">No Role Assigned</span>
                      )}
                    </td>

                    {/* Skills */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {u.skills?.slice(0, 3).map((s: string) => (
                          <span
                            key={s}
                            className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-lg border border-zinc-200/50 dark:border-white/5 font-semibold"
                          >
                            {s}
                          </span>
                        ))}
                        {u.skills?.length > 3 && (
                          <span className="text-[10px] bg-indigo-500/5 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-500/10 font-bold">
                            +{u.skills.length - 3}
                          </span>
                        )}
                        {(!u.skills || u.skills.length === 0) && (
                          <span className="text-zinc-400 dark:text-zinc-600 text-xs italic">-</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border",
                          u.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-zinc-500")} />
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex gap-1 justify-end">
                        {hasPermission("user:update") && (
                          <button
                            onClick={() => openEdit(u)}
                            className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Edit User"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {hasPermission("user:delete") && (
                          <button
                            onClick={() =>
                              confirm(`Delete ${u.name}?`) &&
                              deleteMutation.mutate(u.id)
                            }
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Delete User"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-zinc-500 dark:text-zinc-400 font-medium">
                      No team members found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Edit/Create Modal */}
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
              className="bg-white dark:bg-[#0a0a0a] border border-black/5 dark:border-white/10 rounded-[2rem] shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-black text-2xl text-zinc-900 dark:text-white">
                    {editUser ? "Edit User Profile" : "Register New User"}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {editUser ? "Update credentials and access configuration" : "Create a new team member account"}
                  </p>
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
                    Full Name *
                  </label>
                  <input
                    {...register("name", { required: true })}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="e.g. Alan Turing"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Email Address *
                  </label>
                  <input
                    {...register("email", { required: true })}
                    type="email"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="e.g. alan@nexusai.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    {editUser
                      ? "New Password (leave empty to keep current password)"
                      : "Password *"}
                  </label>
                  <input
                    {...register("password", { required: !editUser })}
                    type="password"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    System Role
                  </label>
                  <select
                    {...register("roleId")}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                  >
                    <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" value="">-- None --</option>
                    {roles.map((r: any) => (
                      <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Skills (comma-separated)
                  </label>
                  <input
                    {...register("skills")}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="React, Node.js, SQL"
                  />
                </div>

                {editUser && (
                  <div className="flex items-center gap-3 py-2">
                    <input
                      {...register("isActive")}
                      type="checkbox"
                      id="isActive"
                      className="rounded border-zinc-300 dark:border-white/10 text-indigo-500 focus:ring-indigo-500 w-4 h-4"
                    />
                    <label htmlFor="isActive" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 select-none">
                      Enable Account Access (Active)
                    </label>
                  </div>
                )}

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
                    {editUser ? "Save Changes" : "Create User"}
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

