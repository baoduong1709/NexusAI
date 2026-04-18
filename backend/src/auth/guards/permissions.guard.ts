import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { PROJECT_SCOPED_PERMISSIONS } from "../permissions";
import {
  getProjectRolePermissions,
  normalizeProjectRoleConfigs,
} from "../../projects/project-roles";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const userPermissions: string[] = user?.permissions || [];

    const projectPermissions = await this.getProjectPermissions(context);
    const mergedPermissions = new Set([
      ...userPermissions,
      ...projectPermissions,
    ]);
    const hasPermission = requiredPermissions.every((perm) =>
      mergedPermissions.has(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }

  private async getProjectPermissions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      !requiredPermissions?.some((permission) =>
        PROJECT_SCOPED_PERMISSIONS.includes(
          permission as (typeof PROJECT_SCOPED_PERMISSIONS)[number],
        ),
      )
    ) {
      return [];
    }

    const projectId = this.resolveProjectId(request);
    if (!projectId || !request.user?.id) return [];

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

    if (!membership?.projectRole) return [];

    const roleConfigs = normalizeProjectRoleConfigs(
      membership.project.projectRoleConfigs,
      membership.project.projectRoles,
    );

    return getProjectRolePermissions(roleConfigs, membership.projectRole);
  }

  private resolveProjectId(request: {
    params?: Record<string, string>;
    originalUrl?: string;
  }) {
    const projectIdParam = request.params?.projectId;
    if (projectIdParam) return Number(projectIdParam);

    const projectDetailId = request.params?.id;
    if (
      projectDetailId &&
      request.originalUrl?.includes("/projects/") &&
      !request.originalUrl.includes("/roles/")
    ) {
      return Number(projectDetailId);
    }

    return undefined;
  }
}
