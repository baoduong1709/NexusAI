// ---- Enums ----
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
export type TaskActivityType = 'COMMENT' | 'HISTORY' | 'WORK_LOG';

// ---- Core Models ----
export interface Role {
  id: number;
  name: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface Company {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  skills: string[];
  roleId: number | null;
  chatLanguage: string;
  chatDescription: string | null;
  companyId: number | null;
  isSuperAdmin: boolean;
  role?: Role;
  company?: Company;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  projectId: string;
  userId: number;
  projectRole: string | null;
  joinedAt: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'skills' | 'role'>;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  projectRoles: string[];
  taskStatuses: string[];
  taskWorkflow: Record<string, string[]> | null;
  epics: string[];
  labels: string[];
  taskNamingRule: string | null;
  createdAt: string;
  updatedAt: string;
  companyId: number | null;
  company?: Company;
  members?: ProjectMember[];
  tasks?: Task[];
  _count?: { tasks: number; members: number; documents: number };
}

export interface TaskLink {
  id: number;
  sourceTaskId: string;
  targetTaskId: string;
  type: string;
  createdAt: string;
  sourceTask?: Pick<Task, 'id' | 'title' | 'status' | 'assignee'>;
  targetTask?: Pick<Task, 'id' | 'title' | 'status' | 'assignee'>;
}

export interface Task {
  id: string;
  sequence: number;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: number | null;
  status: string;
  priority: Priority;
  isAiGenerated: boolean;
  dueDate: string | null;
  epic: string | null;
  labels: string[];
  sprint: string | null;
  estimateHours: number;
  loggedHours: number;
  agentPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: Pick<User, 'id' | 'name' | 'email'>;
  sourceLinks?: TaskLink[];
  targetLinks?: TaskLink[];
  _count?: { activities: number };
}

export interface Document {
  id: number;
  projectId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  folder: string | null;
  uploadedById: number | null;
  storageProvider: string | null;
  createdAt: string;
  url?: string;
  uploadedBy?: Pick<User, 'id' | 'name'>;
}

export interface TaskActivity {
  id: number;
  taskId: string;
  userId: number | null;
  type: TaskActivityType;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  body: string | null;
  durationHours: number | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name'>;
}

export interface AiChatSession {
  id: number;
  projectId: string;
  userId: number;
  name: string;
  summary: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---- API Request payloads ----
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  roleId?: number;
  skills?: string[];
  isActive?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  roleId?: number | null;
  skills?: string[];
  isActive?: boolean;
}

export interface CreateRolePayload {
  name: string;
  permissions: string[];
}

export interface UpdateRolePayload {
  name?: string;
  permissions?: string[];
}

export interface CreateProjectPayload {
  id: string;
  name: string;
  description?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  memberIds?: number[];
  projectRoles?: string[];
  taskStatuses?: string[];
  epics?: string[];
  labels?: string[];
  taskNamingRule?: string;
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {
  status?: ProjectStatus;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigneeId?: number;
  status?: string;
  priority?: Priority;
  dueDate?: string;
  epic?: string;
  labels?: string[];
  sprint?: string;
  estimateHours?: number;
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {}

// ---- Paginated Response ----
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}

export interface RequirementsHistory {
  id: number;
  projectId?: string;
  version: number;
  content: string;
  changesSummary: string | null;
  createdAt: string;
}
