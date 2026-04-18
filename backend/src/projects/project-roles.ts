import { BadRequestException } from "@nestjs/common";
import { PROJECT_SCOPED_PERMISSIONS } from "../auth/permissions";

export interface ProjectRoleConfig {
  name: string;
  permissions: string[];
}

const PROJECT_ROLE_PERMISSION_TEMPLATES: Record<string, string[]> = {
  pm: [
    "project:read",
    "project:update",
    "task:create",
    "task:read",
    "task:update",
    "task:delete",
    "task:approve_ai",
    "document:upload",
    "document:delete",
    "ai:analyze",
  ],
  "tech lead": [
    "project:read",
    "task:create",
    "task:read",
    "task:update",
    "task:approve_ai",
    "document:upload",
    "ai:analyze",
  ],
  lead: [
    "project:read",
    "task:create",
    "task:read",
    "task:update",
    "task:approve_ai",
    "document:upload",
    "ai:analyze",
  ],
  developer: ["project:read", "task:read", "task:update"],
  designer: ["project:read", "task:read", "task:update"],
  tester: ["project:read", "task:read", "task:update"],
  ba: ["project:read", "task:read", "task:update"],
  devops: ["project:read", "task:read", "task:update"],
};

export const DEFAULT_PROJECT_ROLES = [
  "Developer",
  "Tech Lead",
  "Designer",
  "Tester",
  "PM",
  "BA",
  "DevOps",
];

export const DEFAULT_PROJECT_ROLE_CONFIGS = DEFAULT_PROJECT_ROLES.map(
  (name) => ({
    name,
    permissions: getDefaultProjectRolePermissions(name),
  }),
);

function uniquePermissions(permissions?: string[]) {
  const normalized = (permissions ?? [])
    .map((permission) => permission?.trim())
    .filter((permission): permission is string => Boolean(permission));

  const allowed = new Set(PROJECT_SCOPED_PERMISSIONS);
  const invalidPermissions = normalized.filter(
    (permission) =>
      !allowed.has(permission as (typeof PROJECT_SCOPED_PERMISSIONS)[number]),
  );

  if (invalidPermissions.length) {
    throw new BadRequestException(
      `Invalid project role permissions: ${invalidPermissions.join(", ")}`,
    );
  }

  return Array.from(new Set(normalized));
}

export function getDefaultProjectRolePermissions(roleName: string) {
  return [
    ...(PROJECT_ROLE_PERMISSION_TEMPLATES[roleName.trim().toLowerCase()] ?? [
      "project:read",
      "task:read",
      "task:update",
    ]),
  ];
}

export function normalizeProjectRoles(roles?: string[]) {
  return normalizeProjectRoleConfigs(
    (roles?.length ? roles : DEFAULT_PROJECT_ROLES).map((name) => ({
      name,
      permissions: getDefaultProjectRolePermissions(name),
    })),
  ).map((role) => role.name);
}

export function normalizeProjectRoleConfigs(
  roles?: unknown,
  fallbackRoles?: string[],
) {
  const source =
    Array.isArray(roles) && roles.length > 0
      ? roles
      : fallbackRoles?.length
        ? fallbackRoles.map((name) => ({
            name,
            permissions: getDefaultProjectRolePermissions(name),
          }))
        : DEFAULT_PROJECT_ROLE_CONFIGS;

  const normalized = source
    .map((role) => {
      if (typeof role === "string") {
        const name = role.trim();
        return name
          ? {
              name,
              permissions: getDefaultProjectRolePermissions(name),
            }
          : null;
      }

      if (!role || typeof role !== "object") return null;
      const entry = role as { name?: unknown; permissions?: unknown };
      const name = typeof entry.name === "string" ? entry.name.trim() : "";

      return name
        ? {
            name,
            permissions: uniquePermissions(
              Array.isArray(entry.permissions)
                ? entry.permissions.filter(
                    (permission): permission is string =>
                      typeof permission === "string",
                  )
                : getDefaultProjectRolePermissions(name),
            ),
          }
        : null;
    })
    .filter((role): role is ProjectRoleConfig => Boolean(role));

  if (!normalized.length) {
    throw new BadRequestException("Project must contain at least 1 role");
  }

  const unique = new Set(normalized.map((role) => role.name.toLowerCase()));
  if (unique.size !== normalized.length) {
    throw new BadRequestException("Project roles must be unique");
  }

  return normalized;
}

export function getProjectRoleNames(roleConfigs: ProjectRoleConfig[]) {
  return roleConfigs.map((role) => role.name);
}

export function normalizeProjectRole(role?: string | null) {
  const normalized = role?.trim();
  return normalized ? normalized : undefined;
}

export function getProjectRolePermissions(
  roleConfigs: ProjectRoleConfig[],
  roleName?: string | null,
) {
  const normalizedRole = normalizeProjectRole(roleName);
  if (!normalizedRole) return [];

  return (
    roleConfigs.find(
      (role) => role.name.toLowerCase() === normalizedRole.toLowerCase(),
    )?.permissions ?? []
  );
}
