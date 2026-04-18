"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const prisma_service_1 = require("../../prisma/prisma.service");
const permissions_1 = require("../permissions");
const project_roles_1 = require("../../projects/project-roles");
let PermissionsGuard = class PermissionsGuard {
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const requiredPermissions = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }
        const { user } = context.switchToHttp().getRequest();
        const userPermissions = user?.permissions || [];
        const projectPermissions = await this.getProjectPermissions(context);
        const mergedPermissions = new Set([
            ...userPermissions,
            ...projectPermissions,
        ]);
        const hasPermission = requiredPermissions.every((perm) => mergedPermissions.has(perm));
        if (!hasPermission) {
            throw new common_1.ForbiddenException("Insufficient permissions");
        }
        return true;
    }
    async getProjectPermissions(context) {
        const request = context.switchToHttp().getRequest();
        const requiredPermissions = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredPermissions?.some((permission) => permissions_1.PROJECT_SCOPED_PERMISSIONS.includes(permission))) {
            return [];
        }
        const projectId = this.resolveProjectId(request);
        if (!projectId || !request.user?.id)
            return [];
        const membership = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: request.user.id,
                },
            },
            select: {
                projectRole: true,
                project: {
                    select: {
                        projectRoles: true,
                        projectRoleConfigs: true,
                    },
                },
            },
        });
        if (!membership?.projectRole)
            return [];
        const roleConfigs = (0, project_roles_1.normalizeProjectRoleConfigs)(membership.project.projectRoleConfigs, membership.project.projectRoles);
        return (0, project_roles_1.getProjectRolePermissions)(roleConfigs, membership.projectRole);
    }
    resolveProjectId(request) {
        const projectIdParam = request.params?.projectId;
        if (projectIdParam)
            return Number(projectIdParam);
        const projectDetailId = request.params?.id;
        if (projectDetailId &&
            request.originalUrl?.includes("/projects/") &&
            !request.originalUrl.includes("/roles/")) {
            return Number(projectDetailId);
        }
        return undefined;
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map