import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("nexusai_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("nexusai_token");
      localStorage.removeItem("nexusai_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  getProfile: () => api.get("/auth/profile"),
};

// ---- Users ----
export const usersApi = {
  getAll: () => api.get("/users"),
  getOne: (id: number) => api.get(`/users/${id}`),
  create: (data: any) => api.post("/users", data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// ---- Roles ----
export const rolesApi = {
  getAll: () => api.get("/roles"),
  getPermissions: () => api.get("/roles/permissions"),
  create: (data: any) => api.post("/roles", data),
  update: (id: number, data: any) => api.put(`/roles/${id}`, data),
  delete: (id: number) => api.delete(`/roles/${id}`),
};

// ---- Projects ----
export const projectsApi = {
  getAll: () => api.get("/projects"),
  getOne: (id: number) => api.get(`/projects/${id}`),
  create: (data: any) => api.post("/projects", data),
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
  updateWorkflow: (id: number, data: any) =>
    api.patch(`/projects/${id}/workflow`, data),
  updateRoles: (id: number, data: any) =>
    api.patch(`/projects/${id}/roles`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  addMember: (projectId: number, userId: number, projectRole?: string) =>
    api.post(`/projects/${projectId}/members/${userId}`, { projectRole }),
  updateMemberRole: (projectId: number, userId: number, projectRole: string) =>
    api.patch(`/projects/${projectId}/members/${userId}`, { projectRole }),
  removeMember: (projectId: number, userId: number) =>
    api.delete(`/projects/${projectId}/members/${userId}`),
};

// ---- Tasks ----
export const tasksApi = {
  getAll: (projectId: number) => api.get(`/projects/${projectId}/tasks`),
  create: (projectId: number, data: any) =>
    api.post(`/projects/${projectId}/tasks`, data),
  update: (projectId: number, taskId: string, data: any) =>
    api.put(`/projects/${projectId}/tasks/${taskId}`, data),
  updateStatus: (projectId: number, taskId: string, status: string) =>
    api.patch(`/projects/${projectId}/tasks/${taskId}/status`, { status }),
  getActivities: (projectId: number, taskId: string) =>
    api.get(`/projects/${projectId}/tasks/${taskId}/activities`),
  addComment: (projectId: number, taskId: string, body: string) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { body }),
  addWorkLog: (
    projectId: number,
    taskId: string,
    data: { durationHours: number; note?: string },
  ) => api.post(`/projects/${projectId}/tasks/${taskId}/worklogs`, data),
  delete: (projectId: number, taskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`),
};

// ---- Documents ----
export const documentsApi = {
  getAll: (projectId: number) => api.get(`/projects/${projectId}/documents`),
  upload: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/projects/${projectId}/documents/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  delete: (projectId: number, docId: number) =>
    api.delete(`/projects/${projectId}/documents/${docId}`),
};

// ---- AI ----
export const aiApi = {
  analyze: (projectId: number) => api.post(`/projects/${projectId}/ai/analyze`),
  getRequirements: (projectId: number) =>
    api.get(`/projects/${projectId}/ai/requirements`),
  getHistory: (projectId: number) =>
    api.get(`/projects/${projectId}/ai/requirements/history`),
  getVersion: (projectId: number, historyId: number) =>
    api.get(`/projects/${projectId}/ai/requirements/version/${historyId}`),
  updateRequirements: (projectId: number) =>
    api.post(`/projects/${projectId}/ai/requirements/update`),
  confirmTasks: (projectId: number, tasks: any[]) =>
    api.post(`/projects/${projectId}/ai/confirm-tasks`, { tasks }),
  suggestAssignee: (projectId: number, taskDescription: string) =>
    api.post(`/projects/${projectId}/ai/suggest-assignee`, { taskDescription }),
  improveDescription: (
    projectId: number,
    payload: { title?: string; description: string },
  ) => api.post(`/projects/${projectId}/ai/description/improve`, payload),
  assistDescription: (
    projectId: number,
    payload: { title?: string; description: string; instruction: string },
  ) => api.post(`/projects/${projectId}/ai/description/assist`, payload),
  chat: (
    projectId: number,
    messages: { role: string; content: string }[],
    summary?: string,
  ) => api.post(`/projects/${projectId}/ai/chat`, { messages, summary }),
  summarize: (
    projectId: number,
    currentSummary: string,
    messages: { role: string; content: string }[],
  ) =>
    api.post(`/projects/${projectId}/ai/summarize`, {
      currentSummary,
      messages,
    }),
  listSessions: (projectId: number) =>
    api.get(`/projects/${projectId}/ai/sessions`),
  createSession: (projectId: number, name: string) =>
    api.post(`/projects/${projectId}/ai/sessions`, { name }),
  updateSession: (
    projectId: number,
    sessionId: number,
    data: { name?: string; summary?: string; messages?: any[] },
  ) => api.put(`/projects/${projectId}/ai/sessions/${sessionId}`, data),
  deleteSession: (projectId: number, sessionId: number) =>
    api.delete(`/projects/${projectId}/ai/sessions/${sessionId}`),
};
