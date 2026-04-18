import { AiService } from "./ai.service";
import { ConfirmAiTasksDto, SuggestAssigneeDto, AiChatDto } from "./dto/ai.dto";
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    analyze(projectId: number): Promise<import("./ai.service").AiAnalysisResult>;
    getRequirements(projectId: number): Promise<{
        content: string;
        version: number;
    }>;
    getHistory(projectId: number): Promise<{
        id: number;
        createdAt: Date;
        version: number;
        changesSummary: string;
    }[]>;
    getVersion(historyId: number): Promise<{
        id: number;
        version: number;
        content: string;
        changesSummary: string | null;
        createdAt: Date;
    }>;
    updateRequirements(projectId: number): Promise<{
        content: string;
        version: number;
    }>;
    confirmTasks(projectId: number, dto: ConfirmAiTasksDto): Promise<({
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
    suggestAssignee(projectId: number, dto: SuggestAssigneeDto): Promise<any>;
    chat(projectId: number, dto: AiChatDto): Promise<import("./ai.service").ChatResponse>;
}
