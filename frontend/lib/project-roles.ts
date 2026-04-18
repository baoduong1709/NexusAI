export interface ProjectRoleConfig {
  name: string;
  permissions: string[];
}

export const PROJECT_ROLE_PERMISSION_GROUPS = [
  {
    label: "Project",
    permissions: ["project:read", "project:update", "project:delete"],
  },
  {
    label: "Task",
    permissions: [
      "task:create",
      "task:read",
      "task:update",
      "task:delete",
      "task:approve_ai",
    ],
  },
  {
    label: "Document",
    permissions: ["document:upload", "document:delete"],
  },
  {
    label: "AI",
    permissions: ["ai:analyze"],
  },
] as const;

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

export const DEFAULT_PROJECT_ROLE_CONFIGS = DEFAULT_PROJECT_ROLES.map((name) => ({
  name,
  permissions: getDefaultProjectRolePermissions(name),
}));

function uniquePermissions(permissions?: string[]) {
  return Array.from(new Set((permissions ?? []).map((perm) => perm.trim()).filter(Boolean)));
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

export function normalizeProjectRoleConfigs(
  roles?: Array<string | Partial<ProjectRoleConfig>>,
) {
  const source = roles?.length ? roles : DEFAULT_PROJECT_ROLE_CONFIGS;

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

      const name = role.name?.trim() || "";
      if (!name) return null;

      return {
        name,
        permissions: uniquePermissions(
          role.permissions?.length
            ? role.permissions
            : getDefaultProjectRolePermissions(name),
        ),
      };
    })
    .filter((role): role is ProjectRoleConfig => Boolean(role));

  return normalized.filter(
    (role, index, items) =>
      items.findIndex(
        (candidate) => candidate.name.toLowerCase() === role.name.toLowerCase(),
      ) === index,
  );
}

export function normalizeProjectRoles(roles?: string[]) {
  return normalizeProjectRoleConfigs(roles).map((role) => role.name);
}

export function getProjectRolePermissions(
  roleConfigs: ProjectRoleConfig[],
  roleName?: string | null,
) {
  const normalizedRole = roleName?.trim().toLowerCase();
  if (!normalizedRole) return [];

  return (
    roleConfigs.find((role) => role.name.toLowerCase() === normalizedRole)
      ?.permissions ?? []
  );
}
