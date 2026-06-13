import axios from "axios";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  CreateRolePayload,
  UpdateRolePayload,
  CreateProjectPayload,
  UpdateProjectPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  Task,
} from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("nexusai_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;

// ---- Notifications ----
export const notificationsApi = {
  getAll: () => api.get("/notifications"),
  markAsRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post("/notifications/read-all"),
};

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
  getProfile: () => api.get("/auth/profile"),
  generatePersonalToken: (expiresIn: string) => api.post("/auth/personal-token", { expiresIn }),
};

// ---- Users ----
export const usersApi = {
  getAll: () => api.get("/users"),
  getOne: (id: number) => api.get(`/users/${id}`),
  create: (data: CreateUserPayload) => api.post("/users", data),
  update: (id: number, data: UpdateUserPayload) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// ---- Roles ----
export const rolesApi = {
  getAll: () => api.get("/roles"),
  getPermissions: () => api.get("/roles/permissions"),
  create: (data: CreateRolePayload) => api.post("/roles", data),
  update: (id: number, data: UpdateRolePayload) => api.put(`/roles/${id}`, data),
  delete: (id: number) => api.delete(`/roles/${id}`),
};

// ---- Projects ----
export const projectsApi = {
  getAll: () => api.get("/projects"),
  getOne: (id: string) => api.get(`/projects/${id}`),
  create: (data: CreateProjectPayload) => api.post("/projects", data),
  update: (id: string, data: UpdateProjectPayload) => api.put(`/projects/${id}`, data),
  updateWorkflow: (id: string, data: { taskStatuses: string[]; taskWorkflow: Record<string, string[]> }) =>
    api.patch(`/projects/${id}/workflow`, data),
  updateRoles: (id: string, data: { projectRoles: string[]; projectRoleConfigs: any[] }) =>
    api.patch(`/projects/${id}/roles`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (projectId: string, userId: number, projectRole?: string) =>
    api.post(`/projects/${projectId}/members/${userId}`, { projectRole }),
  updateMemberRole: (projectId: string, userId: number, projectRole: string) =>
    api.patch(`/projects/${projectId}/members/${userId}`, { projectRole }),
  removeMember: (projectId: string, userId: number) =>
    api.delete(`/projects/${projectId}/members/${userId}`),
};

// ---- Tasks ----
export const tasksApi = {
  getAll: (projectId: string, params?: {
    skip?: number;
    take?: number;
    status?: string;
    search?: string;
    priority?: string;
    epic?: string;
    sprint?: string;
    assigneeId?: number;
    labels?: string[];
    dueFrom?: string;
    dueTo?: string;
    ai?: string;
  }) => api.get(`/projects/${projectId}/tasks`, { params }),
  create: (projectId: string, data: CreateTaskPayload) =>
    api.post(`/projects/${projectId}/tasks`, data),
  update: (projectId: string, taskId: string, data: UpdateTaskPayload) =>
    api.put(`/projects/${projectId}/tasks/${taskId}`, data),
  updateStatus: (projectId: string, taskId: string, status: string) =>
    api.patch(`/projects/${projectId}/tasks/${taskId}/status`, { status }),
  getActivities: (projectId: string, taskId: string) =>
    api.get(`/projects/${projectId}/tasks/${taskId}/activities`),
  addComment: (projectId: string, taskId: string, body: string) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { body }),
  addWorkLog: (
    projectId: string,
    taskId: string,
    data: { durationHours: number; note?: string },
  ) => api.post(`/projects/${projectId}/tasks/${taskId}/worklogs`, data),
  delete: (projectId: string, taskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`),
  getOneWithoutProject: (taskId: string) =>
    api.get(`/tasks/${taskId}`),
  linkTask: (projectId: string, taskId: string, targetTaskId: string) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/links`, { targetTaskId }),
  unlinkTask: (projectId: string, taskId: string, targetTaskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}/links/${targetTaskId}`),
};

// ---- Documents ----
export const documentsApi = {
  getAll: (projectId: string, params?: {
    skip?: number;
    take?: number;
    folder?: string;
  }) => api.get(`/projects/${projectId}/documents`, { params }),
  upload: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/projects/${projectId}/documents/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  delete: (projectId: string, docId: number) =>
    api.delete(`/projects/${projectId}/documents/${docId}`),
  download: (projectId: string, docId: number) =>
    api.get(`/projects/${projectId}/documents/${docId}/download`, {
      responseType: "blob",
    }),
};

// ---- AI ----
export const aiApi = {
  analyze: (projectId: string) => api.post(`/projects/${projectId}/ai/analyze`),
  getRequirements: (projectId: string) =>
    api.get(`/projects/${projectId}/ai/requirements`),
  getHistory: (projectId: string) =>
    api.get(`/projects/${projectId}/ai/requirements/history`),
  getVersion: (projectId: string, historyId: number) =>
    api.get(`/projects/${projectId}/ai/requirements/version/${historyId}`),
  updateRequirements: (projectId: string) =>
    api.post(`/projects/${projectId}/ai/requirements/update`),
  confirmTasks: (projectId: string, tasks: Partial<Task>[]) =>
    api.post(`/projects/${projectId}/ai/confirm-tasks`, { tasks }),
  suggestAssignee: (projectId: string, taskDescription: string) =>
    api.post(`/projects/${projectId}/ai/suggest-assignee`, { taskDescription }),
  improveDescription: (
    projectId: string,
    payload: { title?: string; description: string },
  ) => api.post(`/projects/${projectId}/ai/description/improve`, payload),
  assistDescription: (
    projectId: string,
    payload: { title?: string; description: string; instruction: string },
  ) => api.post(`/projects/${projectId}/ai/description/assist`, payload),
  generateTaskPrompt: (
    projectId: string,
    payload: {
      taskId?: string;
      title?: string;
      description: string;
      assigneeId?: number;
      labels?: string[];
    },
  ) => api.post(`/projects/${projectId}/ai/description/generate-prompt`, payload),
  getChatSettings: () => api.get("/users/me/chat-settings"),
  updateChatSettings: (payload: { chatLanguage?: string; chatDescription?: string }) =>
    api.put("/users/me/chat-settings", payload),
  chatStream: async (
    projectId: string,
    messages: { role: string; content: string }[],
    summary?: string,
    onChunk?: (text: string) => void,
    onTasksSuggested?: (tasks: any[]) => void,
    onDone?: () => void,
    onError?: (error: any) => void,
    onAgentLog?: (log: any) => void,
    language?: string,
    onWaitingMessage?: (text: string) => void,
  ) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexusai_token") : null;
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/projects/${projectId}/ai/chat-stream`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ messages, summary, language }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No readable stream in response");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          let event = "message";
          let data = "";

          const eventMatch = line.match(/^event:\s*(.*)$/m);
          if (eventMatch) {
            event = eventMatch[1].trim();
          }

          const dataMatch = line.match(/^data:\s*(.*)$/m);
          if (dataMatch) {
            data = dataMatch[1].trim();
          } else {
            const dataLines = line
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.substring(5).trim());
            data = dataLines.join("");
          }

          if (event === "suggest_tasks") {
            try {
              const tasks = JSON.parse(data);
              if (onTasksSuggested) onTasksSuggested(tasks);
            } catch (e) {
              console.error("Failed to parse suggest_tasks data", e);
            }
          } else if (event === "agent_log") {
            try {
              const log = JSON.parse(data);
              if (onAgentLog) onAgentLog(log);
            } catch (e) {
              console.error("Failed to parse agent_log data", e);
            }
          } else if (event === "waiting_message") {
            try {
              const parsed = JSON.parse(data);
              if (onWaitingMessage) onWaitingMessage(parsed.text);
            } catch (e) {
              if (onWaitingMessage) onWaitingMessage(data);
            }
          } else if (event === "error") {
            try {
              const errObj = JSON.parse(data);
              if (onError) onError(errObj);
            } catch {
              if (onError) onError(new Error(data));
            }
          } else if (event === "done") {
            if (onDone) onDone();
          } else if (event === "message" || !event) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.text && onChunk) {
                onChunk(parsed.text);
              }
            } catch {
              if (onChunk && data) onChunk(data);
            }
          }
        }
      }

      if (buffer.trim()) {
        const line = buffer;
        let event = "message";
        let data = "";

        const eventMatch = line.match(/^event:\s*(.*)$/m);
        if (eventMatch) {
          event = eventMatch[1].trim();
        }

        const dataMatch = line.match(/^data:\s*(.*)$/m);
        if (dataMatch) {
          data = dataMatch[1].trim();
        }

        if (event === "suggest_tasks") {
          try {
            const tasks = JSON.parse(data);
            if (onTasksSuggested) onTasksSuggested(tasks);
          } catch (e) {}
        } else if (event === "agent_log") {
          try {
            const log = JSON.parse(data);
            if (onAgentLog) onAgentLog(log);
          } catch (e) {}
        } else if (event === "waiting_message") {
          try {
            const parsed = JSON.parse(data);
            if (onWaitingMessage) onWaitingMessage(parsed.text);
          } catch (e) {
            if (onWaitingMessage) onWaitingMessage(data);
          }
        } else if (event === "done") {
          if (onDone) onDone();
        } else if (event === "message" || !event) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.text && onChunk) onChunk(parsed.text);
          } catch {
            if (onChunk && data) onChunk(data);
          }
        }
      }
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error("chatStream error", error);
      }
    }
  },
  chat: (
    projectId: string,
    messages: { role: string; content: string }[],
    summary?: string,
  ) => api.post(`/projects/${projectId}/ai/chat`, { messages, summary }),
  summarize: (
    projectId: string,
    currentSummary: string,
    messages: { role: string; content: string }[],
  ) =>
    api.post(`/projects/${projectId}/ai/summarize`, {
      currentSummary,
      messages,
    }),
  listSessions: (projectId: string) =>
    api.get(`/projects/${projectId}/ai/sessions`),
  createSession: (projectId: string, name: string) =>
    api.post(`/projects/${projectId}/ai/sessions`, { name }),
  updateSession: (
    projectId: string,
    sessionId: number,
    data: { name?: string; summary?: string; messages?: any[] },
  ) => api.put(`/projects/${projectId}/ai/sessions/${sessionId}`, data),
  deleteSession: (projectId: string, sessionId: number) =>
    api.delete(`/projects/${projectId}/ai/sessions/${sessionId}`),
  getSystemConfigs: () => api.get("/ai/system-configs"),
  updateSystemConfigs: (payload: Record<string, string>) => api.put("/ai/system-configs", payload),
  getTokenSummary: (userId?: number) => api.get("/ai/token-stats/summary", { params: { userId } }),
  getTokenCharts: (userId?: number) => api.get("/ai/token-stats/charts", { params: { userId } }),
  getTokenHistory: (userId?: number, page?: number, limit?: number) =>
    api.get("/ai/token-stats/history", { params: { userId, page, limit } }),
};
