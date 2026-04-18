import { TasksService } from "./tasks.service";
import { CreateTaskDto, UpdateTaskStatusDto } from "./dto/create-task.dto";
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    create(projectId: number, dto: CreateTaskDto): Promise<{
        project: {
            name: string;
            id: number;
            taskStatuses: string[];
            taskWorkflow: import("@prisma/client/runtime/library").JsonValue;
        };
        assignee: {
            name: string;
            id: number;
            email: string;
        };
    } & {
        projectId: number;
        id: number;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        priority: import(".prisma/client").$Enums.Priority;
        isAiGenerated: boolean;
        dueDate: Date | null;
        sprint: string | null;
        assigneeId: number | null;
    }>;
    findAll(projectId: number): Promise<({
        project: {
            name: string;
            id: number;
            taskStatuses: string[];
            taskWorkflow: import("@prisma/client/runtime/library").JsonValue;
        };
        assignee: {
            name: string;
            id: number;
            email: string;
        };
    } & {
        projectId: number;
        id: number;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        priority: import(".prisma/client").$Enums.Priority;
        isAiGenerated: boolean;
        dueDate: Date | null;
        sprint: string | null;
        assigneeId: number | null;
    })[]>;
    findOne(id: number): Promise<{
        project: {
            name: string;
            id: number;
            taskStatuses: string[];
            taskWorkflow: import("@prisma/client/runtime/library").JsonValue;
        };
        assignee: {
            name: string;
            id: number;
            email: string;
        };
    } & {
        projectId: number;
        id: number;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        priority: import(".prisma/client").$Enums.Priority;
        isAiGenerated: boolean;
        dueDate: Date | null;
        sprint: string | null;
        assigneeId: number | null;
    }>;
    update(id: number, dto: CreateTaskDto): Promise<{
        project: {
            name: string;
            id: number;
            taskStatuses: string[];
            taskWorkflow: import("@prisma/client/runtime/library").JsonValue;
        };
        assignee: {
            name: string;
            id: number;
            email: string;
        };
    } & {
        projectId: number;
        id: number;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        priority: import(".prisma/client").$Enums.Priority;
        isAiGenerated: boolean;
        dueDate: Date | null;
        sprint: string | null;
        assigneeId: number | null;
    }>;
    updateStatus(id: number, dto: UpdateTaskStatusDto): Promise<{
        project: {
            name: string;
            id: number;
            taskStatuses: string[];
            taskWorkflow: import("@prisma/client/runtime/library").JsonValue;
        };
        assignee: {
            name: string;
            id: number;
            email: string;
        };
    } & {
        projectId: number;
        id: number;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        priority: import(".prisma/client").$Enums.Priority;
        isAiGenerated: boolean;
        dueDate: Date | null;
        sprint: string | null;
        assigneeId: number | null;
    }>;
    remove(id: number): Promise<{
        projectId: number;
        id: number;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        priority: import(".prisma/client").$Enums.Priority;
        isAiGenerated: boolean;
        dueDate: Date | null;
        sprint: string | null;
        assigneeId: number | null;
    }>;
}
