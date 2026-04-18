"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROJECT_ROLE_CONFIGS = exports.DEFAULT_PROJECT_ROLES = void 0;
exports.getDefaultProjectRolePermissions = getDefaultProjectRolePermissions;
exports.normalizeProjectRoles = normalizeProjectRoles;
exports.normalizeProjectRoleConfigs = normalizeProjectRoleConfigs;
exports.getProjectRoleNames = getProjectRoleNames;
exports.normalizeProjectRole = normalizeProjectRole;
exports.getProjectRolePermissions = getProjectRolePermissions;
const common_1 = require("@nestjs/common");
const permissions_1 = require("../auth/permissions");
const PROJECT_ROLE_PERMISSION_TEMPLATES = {
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
exports.DEFAULT_PROJECT_ROLES = [
    "Developer",
    "Tech Lead",
    "Designer",
    "Tester",
    "PM",
    "BA",
    "DevOps",
];
exports.DEFAULT_PROJECT_ROLE_CONFIGS = exports.DEFAULT_PROJECT_ROLES.map((name) => ({
    name,
    permissions: getDefaultProjectRolePermissions(name),
}));
function uniquePermissions(permissions) {
    const normalized = (permissions ?? [])
        .map((permission) => permission?.trim())
        .filter((permission) => Boolean(permission));
    const allowed = new Set(permissions_1.PROJECT_SCOPED_PERMISSIONS);
    const invalidPermissions = normalized.filter((permission) => !allowed.has(permission));
    if (invalidPermissions.length) {
        throw new common_1.BadRequestException(`Invalid project role permissions: ${invalidPermissions.join(", ")}`);
    }
    return Array.from(new Set(normalized));
}
function getDefaultProjectRolePermissions(roleName) {
    return [
        ...(PROJECT_ROLE_PERMISSION_TEMPLATES[roleName.trim().toLowerCase()] ?? [
            "project:read",
            "task:read",
            "task:update",
        ]),
    ];
}
function normalizeProjectRoles(roles) {
    return normalizeProjectRoleConfigs((roles?.length ? roles : exports.DEFAULT_PROJECT_ROLES).map((name) => ({
        name,
        permissions: getDefaultProjectRolePermissions(name),
    }))).map((role) => role.name);
}
function normalizeProjectRoleConfigs(roles, fallbackRoles) {
    const source = Array.isArray(roles) && roles.length > 0
        ? roles
        : fallbackRoles?.length
            ? fallbackRoles.map((name) => ({
                name,
                permissions: getDefaultProjectRolePermissions(name),
            }))
            : exports.DEFAULT_PROJECT_ROLE_CONFIGS;
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
        if (!role || typeof role !== "object")
            return null;
        const entry = role;
        const name = typeof entry.name === "string" ? entry.name.trim() : "";
        return name
            ? {
                name,
                permissions: uniquePermissions(Array.isArray(entry.permissions)
                    ? entry.permissions.filter((permission) => typeof permission === "string")
                    : getDefaultProjectRolePermissions(name)),
            }
            : null;
    })
        .filter((role) => Boolean(role));
    if (!normalized.length) {
        throw new common_1.BadRequestException("Project must contain at least 1 role");
    }
    const unique = new Set(normalized.map((role) => role.name.toLowerCase()));
    if (unique.size !== normalized.length) {
        throw new common_1.BadRequestException("Project roles must be unique");
    }
    return normalized;
}
function getProjectRoleNames(roleConfigs) {
    return roleConfigs.map((role) => role.name);
}
function normalizeProjectRole(role) {
    const normalized = role?.trim();
    return normalized ? normalized : undefined;
}
function getProjectRolePermissions(roleConfigs, roleName) {
    const normalizedRole = normalizeProjectRole(roleName);
    if (!normalizedRole)
        return [];
    return (roleConfigs.find((role) => role.name.toLowerCase() === normalizedRole.toLowerCase())?.permissions ?? []);
}
//# sourceMappingURL=project-roles.js.map