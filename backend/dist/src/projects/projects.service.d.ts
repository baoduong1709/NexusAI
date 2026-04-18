import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { AiService } from "../ai/ai.service";
import { UpdateProjectWorkflowDto } from "./dto/update-project-workflow.dto";
import { UpdateProjectRolesDto } from "./dto/update-project-roles.dto";
import { ProjectRoleConfig } from "./project-roles";
export declare class ProjectsService {
    private prisma;
    private aiService;
    constructor(prisma: PrismaService, aiService: AiService);
    create(dto: CreateProjectDto): Promise<{
        members: ({
            user: {
                name: string;
                id: number;
                email: string;
                skills: string[];
                role: {
                    name: string;
                };
            };
        } & {
            projectRole: string | null;
            joinedAt: Date;
            userId: number;
            projectId: number;
        })[];
        _count: {
            tasks: number;
            documents: number;
        };
    } & {
        name: string;
        description: string | null;
        budget: number | null;
        startDate: Date | null;
        endDate: Date | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        projectRoles: string[];
        projectRoleConfigs: Prisma.JsonValue;
        taskStatuses: string[];
        taskWorkflow: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    } & {
        projectRoles: string[];
        projectRoleConfigs: ProjectRoleConfig[];
        taskWorkflow: import("./project-workflow").ProjectWorkflow;
        tasks: {
            status: string;
            createdAt: Date;
        }[];
    }>;
    findAll(user: {
        id: number;
        permissions?: string[];
    }): Promise<({
        members: ({
            user: {
                name: string;
                id: number;
                email: string;
                skills: string[];
                role: {
                    name: string;
                };
            };
        } & {
            projectRole: string | null;
            joinedAt: Date;
            userId: number;
            projectId: number;
        })[];
        _count: {
            tasks: number;
            documents: number;
        };
    } & {
        name: string;
        description: string | null;
        budget: number | null;
        startDate: Date | null;
        endDate: Date | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        projectRoles: string[];
        projectRoleConfigs: Prisma.JsonValue;
        taskStatuses: string[];
        taskWorkflow: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    } & {
        projectRoles: string[];
        projectRoleConfigs: ProjectRoleConfig[];
        taskWorkflow: import("./project-workflow").ProjectWorkflow;
        tasks: {
            status: string;
            createdAt: Date;
        }[];
    })[]>;
    findOne(id: number): Promise<{
        members: ({
            user: {
                name: string;
                id: number;
                email: string;
                skills: string[];
                role: {
                    name: string;
                };
            };
        } & {
            projectRole: string | null;
            joinedAt: Date;
            userId: number;
            projectId: number;
        })[];
        tasks: ({
            assignee: {
                name: string;
                id: number;
                email: string;
            };
        } & {
            description: string | null;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            projectId: number;
            title: string;
            assigneeId: number | null;
            priority: import(".prisma/client").$Enums.Priority;
            isAiGenerated: boolean;
            dueDate: Date | null;
            sprint: string | null;
        })[];
        documents: {
            createdAt: Date;
            id: number;
            projectId: number;
            filename: string;
            originalName: string;
            mimeType: string;
            size: number;
            path: string;
        }[];
        _count: {
            tasks: number;
            documents: number;
        };
    } & {
        name: string;
        description: string | null;
        budget: number | null;
        startDate: Date | null;
        endDate: Date | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        projectRoles: string[];
        projectRoleConfigs: Prisma.JsonValue;
        taskStatuses: string[];
        taskWorkflow: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    } & {
        projectRoles: string[];
        projectRoleConfigs: ProjectRoleConfig[];
        taskWorkflow: import("./project-workflow").ProjectWorkflow;
        tasks: {
            status: string;
            createdAt: Date;
        }[];
    }>;
    update(id: number, dto: Partial<CreateProjectDto>): Promise<{
        members: ({
            user: {
                name: string;
                id: number;
                email: string;
                skills: string[];
                role: {
                    name: string;
                };
            };
        } & {
            projectRole: string | null;
            joinedAt: Date;
            userId: number;
            projectId: number;
        })[];
        _count: {
            tasks: number;
            documents: number;
        };
    } & {
        name: string;
        description: string | null;
        budget: number | null;
        startDate: Date | null;
        endDate: Date | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        projectRoles: string[];
        projectRoleConfigs: Prisma.JsonValue;
        taskStatuses: string[];
        taskWorkflow: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    } & {
        projectRoles: string[];
        projectRoleConfigs: ProjectRoleConfig[];
        taskWorkflow: import("./project-workflow").ProjectWorkflow;
        tasks: {
            status: string;
            createdAt: Date;
        }[];
    }>;
    updateWorkflow(id: number, dto: UpdateProjectWorkflowDto): Promise<{
        members: ({
            user: {
                name: string;
                id: number;
                email: string;
                skills: string[];
                role: {
                    name: string;
                };
            };
        } & {
            projectRole: string | null;
            joinedAt: Date;
            userId: number;
            projectId: number;
        })[];
        tasks: ({
            assignee: {
                name: string;
                id: number;
                email: string;
            };
        } & {
            description: string | null;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            projectId: number;
            title: string;
            assigneeId: number | null;
            priority: import(".prisma/client").$Enums.Priority;
            isAiGenerated: boolean;
            dueDate: Date | null;
            sprint: string | null;
        })[];
        documents: {
            createdAt: Date;
            id: number;
            projectId: number;
            filename: string;
            originalName: string;
            mimeType: string;
            size: number;
            path: string;
        }[];
        _count: {
            tasks: number;
            documents: number;
        };
    } & {
        name: string;
        description: string | null;
        budget: number | null;
        startDate: Date | null;
        endDate: Date | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        projectRoles: string[];
        projectRoleConfigs: Prisma.JsonValue;
        taskStatuses: string[];
        taskWorkflow: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    } & {
        projectRoles: string[];
        projectRoleConfigs: ProjectRoleConfig[];
        taskWorkflow: import("./project-workflow").ProjectWorkflow;
        tasks: {
            status: string;
            createdAt: Date;
        }[];
    }>;
    updateRoles(id: number, dto: UpdateProjectRolesDto): Promise<{
        members: ({
            user: {
                name: string;
                id: number;
                email: string;
                skills: string[];
                role: {
                    name: string;
                };
            };
        } & {
            projectRole: string | null;
            joinedAt: Date;
            userId: number;
            projectId: number;
        })[];
        tasks: ({
            assignee: {
                name: string;
                id: number;
                email: string;
            };
        } & {
            description: string | null;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            projectId: number;
            title: string;
            assigneeId: number | null;
            priority: import(".prisma/client").$Enums.Priority;
            isAiGenerated: boolean;
            dueDate: Date | null;
            sprint: string | null;
        })[];
        documents: {
            createdAt: Date;
            id: number;
            projectId: number;
            filename: string;
            originalName: string;
            mimeType: string;
            size: number;
            path: string;
        }[];
        _count: {
            tasks: number;
            documents: number;
        };
    } & {
        name: string;
        description: string | null;
        budget: number | null;
        startDate: Date | null;
        endDate: Date | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        projectRoles: string[];
        projectRoleConfigs: Prisma.JsonValue;
        taskStatuses: string[];
        taskWorkflow: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    } & {
        projectRoles: string[];
        projectRoleConfigs: ProjectRoleConfig[];
        taskWorkflow: import("./project-workflow").ProjectWorkflow;
        tasks: {
            status: string;
            createdAt: Date;
        }[];
    }>;
    remove(id: number): Promise<{
        name: string;
        description: string | null;
        budget: number | null;
        startDate: Date | null;
        endDate: Date | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        projectRoles: string[];
        projectRoleConfigs: Prisma.JsonValue;
        taskStatuses: string[];
        taskWorkflow: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    }>;
    addMember(projectId: number, userId: number, projectRole?: string): Promise<{
        projectRole: string | null;
        joinedAt: Date;
        userId: number;
        projectId: number;
    }>;
    updateMemberRole(projectId: number, userId: number, projectRole: string): Promise<{
        projectRole: string | null;
        joinedAt: Date;
        userId: number;
        projectId: number;
    }>;
    removeMember(projectId: number, userId: number): Promise<{
        projectRole: string | null;
        joinedAt: Date;
        userId: number;
        projectId: number;
    }>;
    private ensureProjectRoleExists;
    private attachProjectMetadata;
}
