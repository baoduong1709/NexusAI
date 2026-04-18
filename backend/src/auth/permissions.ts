export const AVAILABLE_PERMISSIONS = [
  "user:create",
  "user:read",
  "user:update",
  "user:delete",
  "role:create",
  "role:read",
  "role:update",
  "role:delete",
  "project:create",
  "project:read",
  "project:update",
  "project:delete",
  "task:create",
  "task:read",
  "task:update",
  "task:delete",
  "task:approve_ai",
  "document:upload",
  "document:delete",
  "ai:analyze",
] as const;

export const PROJECT_SCOPED_PERMISSIONS = [
  "project:read",
  "project:update",
  "project:delete",
  "task:create",
  "task:read",
  "task:update",
  "task:delete",
  "task:approve_ai",
  "document:upload",
  "document:delete",
  "ai:analyze",
] as const;

export type ProjectScopedPermission =
  (typeof PROJECT_SCOPED_PERMISSIONS)[number];
