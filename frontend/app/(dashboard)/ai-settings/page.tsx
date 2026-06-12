"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { aiApi, usersApi } from "@/lib/api";
import AccessDenied from "@/components/layout/access-denied";
import { toast } from "sonner";
import {
  Cpu,
  Key,
  Globe,
  Database,
  BarChart3,
  History,
  Settings,
  Users,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Info
} from "lucide-react";

interface TokenSummary {
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  modelBreakdown: { model: string; totalTokens: number }[];
}

interface ChartItem {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface LogItem {
  id: number;
  userName: string;
  userEmail: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestType: string;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AiSettingsPage() {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("token:read");
  const canWriteConfig = hasPermission("system:config:write");
  const canReadConfig = hasPermission("system:config:read");
  const hasAccess = isAdmin || canWriteConfig || canReadConfig;

  const [activeTab, setActiveTab] = useState<"stats" | "configs">("stats");

  // Config form state (local, editable)
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [proModel, setProModel] = useState("");
  const [flashModel, setFlashModel] = useState("");
  const [summaryModel, setSummaryModel] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Stats UI state
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [statsPage, setStatsPage] = useState(1);
  const qc = useQueryClient();

  // --- React Query: Config ---
  const { data: configData, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["ai-system-configs"],
    queryFn: () => aiApi.getSystemConfigs().then(r => r.data),
    enabled: activeTab === "configs" && canWriteConfig,
  });

  // Initialize form state when config loads
  useEffect(() => {
    if (configData) {
      setApiBase(configData.AI_API_BASE || "");
      setApiKey(configData.AI_API_KEY || "");
      setProModel(configData.AI_PRO_MODEL || "");
      setFlashModel(configData.AI_FLASH_MODEL || "");
      setSummaryModel(configData.AI_SUMMARY_MODEL || "");
      setEmbeddingModel(configData.AI_EMBEDDING_MODEL || "");
    }
  }, [configData]);

  // --- React Query: Users List ---
  const { data: usersList = [] } = useQuery<{ id: number; name: string; email: string }[]>({
    queryKey: ["users-list"],
    queryFn: () => usersApi.getAll().then(r => r.data || []),
    enabled: isAdmin,
  });

  // --- React Query: Token Stats ---
  const userIdNum = selectedUser && selectedUser !== "all" ? parseInt(selectedUser, 10) : undefined;

  const { data: summaryData } = useQuery<TokenSummary | null>({
    queryKey: ["token-summary", userIdNum],
    queryFn: () => aiApi.getTokenSummary(userIdNum).then(r => r.data),
    enabled: activeTab === "stats" && hasAccess,
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["token-charts", userIdNum],
    queryFn: () => aiApi.getTokenCharts(userIdNum).then(r => r.data),
    enabled: activeTab === "stats" && hasAccess,
  });

  const { data: historyData, isLoading: isLoadingStats } = useQuery({
    queryKey: ["token-history", userIdNum, statsPage],
    queryFn: () => aiApi.getTokenHistory(userIdNum, statsPage, 10).then(r => r.data),
    enabled: activeTab === "stats" && hasAccess,
  });

  // Derive display values from query data
  const summary = summaryData ?? null;
  const logs: LogItem[] = historyData?.data || [];
  const pagination: PaginationMeta = historyData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await aiApi.updateSystemConfigs({
        AI_API_BASE: apiBase,
        AI_API_KEY: apiKey,
        AI_PRO_MODEL: proModel,
        AI_FLASH_MODEL: flashModel,
        AI_SUMMARY_MODEL: summaryModel,
        AI_EMBEDDING_MODEL: embeddingModel,
      });
      // Invalidate cached config so next tab switch fetches fresh data
      qc.invalidateQueries({ queryKey: ["ai-system-configs"] });
      toast.success("Đã cập nhật cấu hình AI thành công");
      qc.invalidateQueries({ queryKey: ["ai-system-configs"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Không thể lưu cấu hình");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Check access permission
  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">
            Cài đặt AI & Thống kê Token
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cấu hình cổng kết nối AI, model định tuyến và quản lý tài nguyên token sử dụng.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-zinc-100/80 dark:bg-zinc-900/50 backdrop-blur-md p-1 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40">
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "stats"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md shadow-black/5"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <BarChart3 size={16} />
            Thống kê Token
          </button>
          
          {canWriteConfig && (
            <button
              onClick={() => setActiveTab("configs")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === "configs"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md shadow-black/5"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Settings size={16} />
              Cấu hình AI
            </button>
          )}
        </div>
      </div>

      {activeTab === "configs" && canWriteConfig && (
        <div className="bg-card/70 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          {isLoadingConfig ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-indigo-500" size={30} />
              <p className="text-sm text-zinc-500">Đang tải cấu hình...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
                <Cpu className="text-indigo-500" size={22} />
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">API Provider & Models Configuration</h3>
                  <p className="text-xs text-zinc-500">Định cấu hình tài khoản API Key để AI hoạt động</p>
                </div>
              </div>

              {/* API Base */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={13} /> API Base URL
                </label>
                <input
                  type="text"
                  required
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all shadow-inner"
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={13} /> API Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? "text" : "password"}
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-••••••••••••••••••••••••••••••••"
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-4 pr-12 py-3 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Pro Model */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={13} /> Model Pro (High-complexity tasks)
                </label>
                <input
                  type="text"
                  required
                  value={proModel}
                  onChange={(e) => setProModel(e.target.value)}
                  placeholder="deepseek-v4-pro[1m]"
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all shadow-inner"
                />
                <p className="text-[11px] text-zinc-400">Dành cho việc lập kế hoạch, phân tích nghiệp vụ, và suggest tasks chi tiết.</p>
              </div>

              {/* Flash Model */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={13} /> Model Flash (Greetings & Short replies)
                </label>
                <input
                  type="text"
                  required
                  value={flashModel}
                  onChange={(e) => setFlashModel(e.target.value)}
                  placeholder="deepseek-v4-flash[1m]"
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all shadow-inner"
                />
                <p className="text-[11px] text-zinc-400">Dành cho việc phân loại ý định (classifier), câu trả lời nhanh, hội thoại xã giao.</p>
              </div>

              {/* Summary Model */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={13} /> Model tóm tắt tài liệu
                </label>
                <input
                  type="text"
                  required
                  value={summaryModel}
                  onChange={(e) => setSummaryModel(e.target.value)}
                  placeholder="deepseek-v4-flash[1m]"
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all shadow-inner"
                />
                <p className="text-[11px] text-zinc-400">Dùng khi lập chỉ mục và tạo bản tóm tắt cho tài liệu dự án.</p>
              </div>

              {/* Embedding Model */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={13} /> Embedding Model
                </label>
                <input
                  type="text"
                  required
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  placeholder="text-embedding-3-small"
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all shadow-inner"
                />
                <p className="text-[11px] text-zinc-400">Model vector dùng cho RAG. Nhập <code>disabled</code> nếu provider không hỗ trợ embedding; hệ thống sẽ dùng keyword search.</p>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isSavingConfig}
                className="w-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 shadow-lg shadow-black/10 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSavingConfig && <Loader2 className="animate-spin" size={16} />}
                {isSavingConfig ? "Đang lưu..." : "Lưu cấu hình hệ thống"}
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* User selector for Admin */}
          {isAdmin && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-card/65 border border-zinc-200/50 dark:border-white/5 p-4 rounded-2xl">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Users size={14} /> Lọc dữ liệu theo User:
              </span>
              <select
                value={selectedUser}
                onChange={(e) => { setSelectedUser(e.target.value); setStatsPage(1); }}
                className="text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 bg-zinc-50/30 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none transition-all shadow-sm"
              >
                <option value="all">Tất cả người dùng (Toàn hệ thống)</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id.toString()}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card/75 border border-zinc-200/50 dark:border-white/5 rounded-3xl p-5 shadow-lg space-y-1 relative overflow-hidden group">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total Requests</span>
              <p className="text-3xl font-extrabold text-zinc-800 dark:text-zinc-100 transition-colors group-hover:text-indigo-500 dark:group-hover:text-indigo-400 duration-300">
                {isLoadingStats ? "..." : summary?.totalRequests || 0}
              </p>
            </div>

            <div className="bg-card/75 border border-zinc-200/50 dark:border-white/5 rounded-3xl p-5 shadow-lg space-y-1 relative overflow-hidden group">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total Tokens</span>
              <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {isLoadingStats ? "..." : (summary?.totalTokens || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-card/75 border border-zinc-200/50 dark:border-white/5 rounded-3xl p-5 shadow-lg space-y-1 relative overflow-hidden group">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Prompt Tokens</span>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-200">
                {isLoadingStats ? "..." : (summary?.promptTokens || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-card/75 border border-zinc-200/50 dark:border-white/5 rounded-3xl p-5 shadow-lg space-y-1 relative overflow-hidden group">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Completion Tokens</span>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-200">
                {isLoadingStats ? "..." : (summary?.completionTokens || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Charts/Breakdowns and History Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Model Breakdown */}
            <div className="lg:col-span-1 bg-card/70 border border-zinc-200/50 dark:border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800/40">
                <BarChart3 className="text-indigo-500" size={18} />
                <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Model Breakdown</h4>
              </div>

              {isLoadingStats ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="animate-spin text-zinc-400" />
                </div>
              ) : summary?.modelBreakdown && summary.modelBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {summary.modelBreakdown.map((item) => {
                    const percentage = summary.totalTokens > 0 
                      ? (item.totalTokens / summary.totalTokens) * 100 
                      : 0;
                    return (
                      <div key={item.model} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                          <span className="truncate pr-2">{item.model}</span>
                          <span>{(item.totalTokens).toLocaleString()} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${percentage}%` }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-zinc-400">
                  Chưa có dữ liệu thống kê model
                </div>
              )}

              {/* General Info Note */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/20 rounded-2xl flex gap-2.5">
                <Info className="text-zinc-400 flex-shrink-0" size={16} />
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal">
                  Chế độ định tuyến tự động sẽ tự kiểm tra và điều chuyển model: Pro model phục vụ cho các yêu cầu có logic nghiệp vụ phức tạp, Flash model phục vụ trả lời nhanh xã giao nhằm tối ưu hiệu năng và tài nguyên.
                </p>
              </div>
            </div>

            {/* Request History List */}
            <div className="lg:col-span-2 bg-card/70 border border-zinc-200/50 dark:border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/40">
                <div className="flex items-center gap-2">
                  <History className="text-indigo-500" size={18} />
                  <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Lịch sử Request Logs</h4>
                </div>
                {isLoadingStats && <Loader2 className="animate-spin text-zinc-400" size={16} />}
              </div>

              {isLoadingStats ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="animate-spin text-zinc-400" />
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-4">
                  {/* Table view */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                          <th className="py-3 px-2">Thời gian</th>
                          {isAdmin && <th className="py-3 px-2">User</th>}
                          <th className="py-3 px-2">Loại</th>
                          <th className="py-3 px-2">Model</th>
                          <th className="py-3 px-2 text-right">Prompt / Completion</th>
                          <th className="py-3 px-2 text-right">Tổng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => {
                          const dateObj = new Date(log.createdAt);
                          const formattedDate = dateObj.toLocaleDateString("vi-VN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <tr key={log.id} className="border-b border-zinc-100/40 dark:border-zinc-900/20 hover:bg-zinc-50/20 dark:hover:bg-zinc-900/10 text-zinc-700 dark:text-zinc-350">
                              <td className="py-3 px-2 font-medium">{formattedDate}</td>
                              {isAdmin && (
                                <td className="py-3 px-2 truncate max-w-[120px]" title={`${log.userName} (${log.userEmail})`}>
                                  {log.userName}
                                </td>
                              )}
                              <td className="py-3 px-2">
                                <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                                  log.requestType.includes("chat")
                                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                                    : "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"
                                }`}>
                                  {log.requestType}
                                </span>
                              </td>
                              <td className="py-3 px-2 font-mono text-[10px] truncate max-w-[150px]">{log.model}</td>
                              <td className="py-3 px-2 text-right font-mono text-zinc-400 dark:text-zinc-500">
                                {log.promptTokens} / {log.completionTokens}
                              </td>
                              <td className="py-3 px-2 text-right font-bold font-mono text-zinc-900 dark:text-zinc-100">
                                {log.totalTokens}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/40 text-xs font-semibold text-zinc-500">
                      <span>
                        Trang {pagination.page} / {pagination.totalPages} (Tổng {pagination.total} logs)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={pagination.page <= 1}
                          onClick={() => setStatsPage(pagination.page - 1)}
                          className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          disabled={pagination.page >= pagination.totalPages}
                          onClick={() => setStatsPage(pagination.page + 1)}
                          className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center text-xs text-zinc-450 dark:text-zinc-500">
                  Chưa có lịch sử request logs nào được ghi nhận.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
