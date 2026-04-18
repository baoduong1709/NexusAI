import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}
export interface ChatResponse {
    message: string;
    tasksCreated?: {
        id: number;
        title: string;
    }[];
    suggestedTasks?: {
        title: string;
        description?: string;
        priority?: "LOW" | "MEDIUM" | "HIGH";
        dueDate?: string;
        sprint?: string;
        assigneeId?: number | null;
    }[];
}
export interface AiAnalysisResult {
    summary: string;
    suggestedTasks: {
        title: string;
        description: string;
        priority: "LOW" | "MEDIUM" | "HIGH";
        suggestedRole?: string;
    }[];
    keyRequirements: string[];
    requirementsFile?: string;
}
export declare class AiService {
    private config;
    private prisma;
    private tasksService;
    private readonly logger;
    private ai;
    constructor(config: ConfigService, prisma: PrismaService, tasksService: TasksService);
    analyzeProject(projectId: number): Promise<AiAnalysisResult>;
    confirmAndCreateTasks(projectId: number, tasks: any[]): Promise<({
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
    suggestAssignees(projectId: number, taskDescription: string): Promise<any>;
    initRequirements(projectId: number, projectName: string, description?: string): Promise<void>;
    updateRequirements(projectId: number): Promise<{
        content: string;
        version: number;
    }>;
    getRequirementsContent(projectId: number): Promise<{
        content: string;
        version: number;
    } | null>;
    getRequirementsHistory(projectId: number): Promise<{
        id: number;
        createdAt: Date;
        version: number;
        changesSummary: string;
    }[]>;
    getRequirementsVersion(historyId: number): Promise<{
        id: number;
        version: number;
        content: string;
        changesSummary: string | null;
        createdAt: Date;
    } | null>;
    private saveRequirementsFile;
    chat(projectId: number, messages: ChatMessage[]): Promise<ChatResponse>;
    private buildRequirementsMarkdown;
}
