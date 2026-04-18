import { PrismaService } from "../prisma/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
export declare class RolesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateRoleDto): Promise<{
        permissions: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        permissions: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOne(id: number): Promise<{
        permissions: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: number, dto: Partial<CreateRoleDto>): Promise<{
        permissions: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: number): Promise<{
        permissions: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getAvailablePermissions(): ("project:read" | "task:read" | "task:update" | "project:update" | "project:delete" | "task:create" | "task:delete" | "task:approve_ai" | "document:upload" | "document:delete" | "ai:analyze" | "project:create" | "role:read" | "user:create" | "user:read" | "user:update" | "user:delete" | "role:create" | "role:update" | "role:delete")[];
}
