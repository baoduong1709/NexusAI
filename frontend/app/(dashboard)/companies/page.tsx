"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { Plus, Pencil, Trash2, Loader2, Search, X, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { getInitials, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import AccessDenied from "@/components/layout/access-denied";

export default function CompaniesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCompany, setEditCompany] = useState<any>(null);

  const isSuperAdmin = user?.isSuperAdmin ?? false;

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesApi.getAll().then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => companiesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company created successfully");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error creating company"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => companiesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company updated successfully");
      setShowModal(false);
      setEditCompany(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error updating company"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => companiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company deleted successfully");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error deleting company"),
  });

  const { register, handleSubmit, reset } = useForm<any>();

  if (!isSuperAdmin) {
    return <AccessDenied />;
  }

  const openCreate = () => {
    reset({ name: "" });
    setEditCompany(null);
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    reset({ name: c.name });
    setEditCompany(c);
    setShowModal(true);
  };

  const onSubmit = (data: any) => {
    if (editCompany) {
      updateMutation.mutate({ id: editCompany.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = companies.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

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

  const avatarGradients = [
    'from-indigo-500 to-violet-500 shadow-indigo-500/20',
    'from-emerald-500 to-teal-500 shadow-emerald-500/20',
    'from-amber-500 to-orange-500 shadow-amber-500/20',
    'from-rose-500 to-pink-500 shadow-rose-500/20',
    'from-cyan-500 to-blue-500 shadow-cyan-500/20',
    'from-fuchsia-500 to-purple-500 shadow-fuchsia-500/20',
  ];

  const getAvatarGradient = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarGradients[Math.abs(hash) % avatarGradients.length];
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Companies
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 font-medium">
            Manage organizations (tenants) across the NexusAI platform
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCreate}
          className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xl shadow-black/5 dark:shadow-black/20 text-sm font-bold"
        >
          <Plus size={16} /> Add Company
        </motion.button>
      </motion.div>

      <motion.div variants={itemVariants} className="relative">
        <Search className="absolute left-4 top-3.5 text-zinc-400 dark:text-zinc-500" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company name..."
          className="w-full pl-12 pr-4 py-3.5 bg-card/85 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/30 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-all shadow-lg shadow-black/5"
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="bg-card/80 backdrop-blur-xl border border-zinc-200/80 dark:border-white/5 rounded-3xl shadow-xl overflow-hidden relative z-10"
      >
        {isLoading ? (
          <div className="py-24 flex flex-col justify-center items-center gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className="text-sm text-zinc-500 font-medium">Loading companies directory...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                  {["Company Name", "Users", "Projects", "Created At", ""].map((h) => (
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
                {filtered.map((c: any) => (
                  <tr
                    key={c.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`bg-gradient-to-br ${getAvatarGradient(c.name)} text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm shadow-md ring-2 ring-white/50 dark:ring-white/5`}>
                          <Building2 size={18} />
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                      {c._count?.users || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                      {c._count?.projects || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                          title="Edit Company"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={async () => {
                            const isConfirmed = await confirm({
                              title: "Delete Company",
                              message: `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
                              confirmText: "Delete",
                              cancelText: "Cancel",
                              variant: "destructive",
                            });
                            if (isConfirmed) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          title="Delete Company"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-zinc-500 dark:text-zinc-400 font-medium">
                      No companies found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

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
                    {editCompany ? "Edit Company" : "Register New Company"}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {editCompany ? "Update company details" : "Create a new organization tenant"}
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
                    Company Name *
                  </label>
                  <input
                    {...register("name", { required: true })}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    placeholder="e.g. Acme Corp"
                  />
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
                    {editCompany ? "Save Changes" : "Create Company"}
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
