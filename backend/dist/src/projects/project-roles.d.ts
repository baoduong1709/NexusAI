export interface ProjectRoleConfig {
    name: string;
    permissions: string[];
}
export declare const DEFAULT_PROJECT_ROLES: string[];
export declare const DEFAULT_PROJECT_ROLE_CONFIGS: {
    name: string;
    permissions: string[];
}[];
export declare function getDefaultProjectRolePermissions(roleName: string): string[];
export declare function normalizeProjectRoles(roles?: string[]): string[];
export declare function normalizeProjectRoleConfigs(roles?: unknown, fallbackRoles?: string[]): ProjectRoleConfig[];
export declare function getProjectRoleNames(roleConfigs: ProjectRoleConfig[]): string[];
export declare function normalizeProjectRole(role?: string | null): string;
export declare function getProjectRolePermissions(roleConfigs: ProjectRoleConfig[], roleName?: string | null): string[];
