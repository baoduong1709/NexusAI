"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveRequestsApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Search, X, CheckCircle, XCircle, Ban, CalendarOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { getInitials, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import AccessDenied from "@/components/layout/access-denied";
import { useConfirm } from "@/components/providers/confirm-provider";

const leaveTypeLabels: Record<string, string> = {
  ANNUAL: "Nghỉ phép năm",
  SICK: "Nghỉ ốm",
  PERSONAL: "Nghỉ việc riêng",
  MATERNITY: "Nghỉ thai sản",
  UNPAID: "Nghỉ không lương",
  OTHER: "Khác",
};

const leaveStatusLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy",
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("vi-VN");
};

export default function LeaveRequestsPage() {
  const { user, hasPermission } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editLeave, setEditLeave] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewLeave, setReviewLeave] = useState<any>(null);

  const { data: leaveRequests = [], isLoading } = useQuery({
    queryKey: ["leave-requests"],
    queryFn: () => leaveRequestsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => leaveRequestsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      toast.success("Tạo đơn nghỉ phép thành công");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Lỗi khi tạo đơn"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => leaveRequestsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      toast.success("Cập nhật đơn nghỉ phép thành công");
      setShowModal(false);
      setEditLeave(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Lỗi khi cập nhật đơn"),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => leaveRequestsApi.review(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      toast.success("Duyệt đơn nghỉ phép thành công");
      setShowReviewModal(false);
      setReviewLeave(null);
      resetReview();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Lỗi khi duyệt đơn"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => leaveRequestsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      toast.success("Đã hủy đơn nghỉ phép");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Lỗi khi hủy đơn"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => leaveRequestsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      toast.success("Xóa đơn nghỉ phép thành công");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Lỗi khi xóa đơn"),
  });

  const { register, handleSubmit, reset } = useForm<any>();
  const { register: registerReview, handleSubmit: handleReviewSubmit, reset: resetReview } = useForm<any>();

  const openCreate = () => {
    reset({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
    setEditLeave(null);
    setShowModal(true);
  };

  const openEdit = (l: any) => {
    reset({
      type: l.type,
      startDate: l.startDate.split("T")[0],
      endDate: l.endDate.split("T")[0],
      reason: l.reason,
    });
    setEditLeave(l);
    setShowModal(true);
  };

  const openReview = (l: any) => {
    setReviewLeave(l);
    resetReview({ reviewerNote: "" });
    setShowReviewModal(true);
  };

  const onSubmit = (data: any) => {
    const payload = { ...data };
    if (editLeave) {
      updateMutation.mutate({ id: editLeave.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const onReviewSubmit = (data: any, status: 'APPROVED' | 'REJECTED') => {
    reviewMutation.mutate({
      id: reviewLeave.id,
      data: { status, reviewerNote: data.reviewerNote }
    });
  };

  let filtered = leaveRequests.filter(
    (l: any) =>
      (l.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.reason || "").toLowerCase().includes(search.toLowerCase())
  );

  if (statusFilter !== 'ALL') {
    filtered = filtered.filter((l: any) => l.status === statusFilter);
  }

  const statusCounts = leaveRequests.reduce((acc: any, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    acc.ALL = (acc.ALL || 0) + 1;
    return acc;
  }, { ALL: 0 });

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
    if (!name) return avatarGradients[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarGradients[Math.abs(hash) % avatarGradients.length];
  };

  const getLeaveTypeStyle = (type: string) => {
    switch (type) {
      case 'ANNUAL': return 'bg-blue-500/10 text-blue-600';
      case 'SICK': return 'bg-red-500/10 text-red-600';
      case 'PERSONAL': return 'bg-amber-500/10 text-amber-600';
      case 'MATERNITY': return 'bg-pink-500/10 text-pink-600';
      case 'UNPAID': return 'bg-zinc-500/10 text-zinc-600';
      case 'OTHER': return 'bg-purple-500/10 text-purple-600';
      default: return 'bg-zinc-500/10 text-zinc-600';
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Nghỉ phép
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 font-medium">
            Quản lý đơn xin nghỉ phép của nhân viên
          </p>
        </div>
        {hasPermission("leave:create") && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xl shadow-black/5 dark:shadow-black/20 text-sm font-bold"
          >
            <Plus size={16} /> Tạo đơn nghỉ
          </motion.button>
        )}
      </motion.div>

      {/* Status Filter Tabs */}
      <motion.div variants={itemVariants} className="inline-flex gap-2 flex-wrap">
        {[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'PENDING', label: 'Chờ duyệt' },
          { id: 'APPROVED', label: 'Đã duyệt' },
          { id: 'REJECTED', label: 'Từ chối' },
          { id: 'CANCELLED', label: 'Đã hủy' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              statusFilter === tab.id
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black shadow-md"
                : "bg-white/50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
            )}
          >
            {tab.label} <span className="opacity-60 ml-1">({statusCounts[tab.id] || 0})</span>
          </button>
        ))}
      </motion.div>

      {/* Search Bar */}
      <motion.div variants={itemVariants} className="relative">
        <Search className="absolute left-4 top-3.5 text-zinc-400 dark:text-zinc-500" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm theo tên nhân viên hoặc lý do..."
          className="w-full pl-12 pr-4 py-3.5 bg-card/85 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/30 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-all shadow-lg shadow-black/5"
        />
      </motion.div>

      {/* Table Section */}
      <motion.div
        variants={itemVariants}
        className="bg-card/80 backdrop-blur-xl border border-zinc-200/80 dark:border-white/5 rounded-3xl shadow-xl overflow-hidden relative z-10"
      >
        {isLoading ? (
          <div className="py-24 flex flex-col justify-center items-center gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className="text-sm text-zinc-500 font-medium">Đang tải dữ liệu...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                  {["Nhân viên", "Loại nghỉ", "Thời gian", "Số ngày", "Lý do", "Trạng thái", "Hành động"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {filtered.map((l: any) => (
                  <tr
                    key={l.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* User Profile */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`bg-gradient-to-br ${getAvatarGradient(l.user?.name || '')} text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm shadow-md ring-2 ring-white/50 dark:ring-white/5`}>
                          {getInitials(l.user?.name || '?')}
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">
                          {l.user?.name || 'Unknown'}
                        </span>
                      </div>
                    </td>

                    {/* Leave Type */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg", getLeaveTypeStyle(l.type))}>
                        {leaveTypeLabels[l.type] || l.type}
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {formatDate(l.startDate)} → {formatDate(l.endDate)}
                    </td>

                    {/* Total Days */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {l.totalDays} ngày
                    </td>

                    {/* Reason */}
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate text-sm text-zinc-600 dark:text-zinc-400" title={l.reason}>
                        {l.reason}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border",
                          l.status === 'PENDING' && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          l.status === 'APPROVED' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                          l.status === 'REJECTED' && "bg-red-500/10 text-red-600 border-red-500/20",
                          l.status === 'CANCELLED' && "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                        )}
                      >
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          l.status === 'PENDING' && "bg-amber-500",
                          l.status === 'APPROVED' && "bg-emerald-500",
                          l.status === 'REJECTED' && "bg-red-500",
                          l.status === 'CANCELLED' && "bg-zinc-500"
                        )} />
                        {leaveStatusLabels[l.status] || l.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex gap-1 justify-end">
                        {l.status === 'PENDING' && hasPermission("leave:approve") && (
                          <>
                            <button
                              onClick={() => openReview(l)}
                              className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-500/10 rounded-xl transition-all"
                              title="Duyệt đơn"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => openReview(l)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-all"
                              title="Từ chối đơn"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        
                        {l.status === 'PENDING' && l.userId === user?.id && (
                          <>
                            <button
                              onClick={() => openEdit(l)}
                              className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                              title="Sửa đơn"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={async () => {
                                const isConfirmed = await confirm({
                                  title: "Hủy đơn nghỉ phép",
                                  message: "Bạn có chắc chắn muốn hủy đơn xin nghỉ phép này không?",
                                  confirmText: "Hủy đơn",
                                  cancelText: "Quay lại",
                                  variant: "destructive",
                                });
                                if (isConfirmed) {
                                  cancelMutation.mutate(l.id);
                                }
                              }}
                              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-all"
                              title="Hủy đơn"
                            >
                              <Ban size={15} />
                            </button>
                          </>
                        )}

                        {hasPermission("leave:delete") && (
                          <button
                            onClick={async () => {
                              const isConfirmed = await confirm({
                                title: "Xóa đơn",
                                message: "Bạn có chắc chắn muốn xóa đơn nghỉ phép này khỏi hệ thống không? Hành động này không thể hoàn tác.",
                                confirmText: "Xóa",
                                cancelText: "Hủy",
                                variant: "destructive",
                              });
                              if (isConfirmed) {
                                deleteMutation.mutate(l.id);
                              }
                            }}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Xóa đơn"
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
                    <td colSpan={7} className="py-16 text-center text-zinc-500 dark:text-zinc-400 font-medium">
                      Không tìm thấy đơn nghỉ phép nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Modal */}
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
                    {editLeave ? "Sửa đơn xin nghỉ phép" : "Tạo đơn xin nghỉ phép"}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {editLeave ? "Cập nhật thông tin đơn nghỉ phép của bạn" : "Điền thông tin để xin nghỉ phép"}
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
                    Loại nghỉ phép *
                  </label>
                  <select
                    {...register("type", { required: true })}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                  >
                    {Object.entries(leaveTypeLabels).map(([key, label]) => (
                      <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Ngày bắt đầu *
                    </label>
                    <input
                      {...register("startDate", { required: true })}
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Ngày kết thúc *
                    </label>
                    <input
                      {...register("endDate", { required: true })}
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Lý do *
                  </label>
                  <textarea
                    {...register("reason", { required: true })}
                    rows={3}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm resize-none"
                    placeholder="Nhập lý do nghỉ phép..."
                  />
                </div>

                <div className="flex gap-3 justify-end mt-8 border-t border-zinc-200 dark:border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 text-sm text-zinc-500 font-bold hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Hủy
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
                    {editLeave ? "Lưu thay đổi" : "Tạo đơn"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && reviewLeave && (
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
                    Duyệt đơn xin nghỉ
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Xem xét và quyết định đơn nghỉ phép
                  </p>
                </div>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-zinc-50 dark:bg-white/5 rounded-2xl p-4 mb-6 border border-zinc-100 dark:border-white/10">
                <div className="flex flex-col gap-2">
                  <p className="text-sm">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Nhân viên:</span>{" "}
                    <span className="font-bold text-zinc-900 dark:text-white">{reviewLeave.user?.name}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Loại nghỉ:</span>{" "}
                    <span className="font-bold text-zinc-900 dark:text-white">{leaveTypeLabels[reviewLeave.type]}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Thời gian:</span>{" "}
                    <span className="font-bold text-zinc-900 dark:text-white">{formatDate(reviewLeave.startDate)} → {formatDate(reviewLeave.endDate)} ({reviewLeave.totalDays} ngày)</span>
                  </p>
                  <div className="mt-2 text-sm border-t border-zinc-200 dark:border-white/10 pt-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Lý do:</span>
                    <p className="text-zinc-600 dark:text-zinc-400 italic">{reviewLeave.reason}</p>
                  </div>
                </div>
              </div>

              <form className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Ghi chú của người duyệt (Tùy chọn)
                  </label>
                  <textarea
                    {...registerReview("reviewerNote")}
                    rows={2}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all text-sm resize-none"
                    placeholder="Nhập lý do từ chối hoặc ghi chú..."
                  />
                </div>

                <div className="flex gap-3 justify-end mt-8 border-t border-zinc-200 dark:border-white/10 pt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleReviewSubmit((data) => onReviewSubmit(data, 'REJECTED'))}
                    disabled={reviewMutation.isPending}
                    className="px-6 py-3 text-sm bg-red-500 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/20"
                  >
                    Từ chối
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleReviewSubmit((data) => onReviewSubmit(data, 'APPROVED'))}
                    disabled={reviewMutation.isPending}
                    className="px-6 py-3 text-sm bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    Duyệt
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
