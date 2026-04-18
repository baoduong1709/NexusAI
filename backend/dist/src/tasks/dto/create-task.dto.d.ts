import { Priority } from "@prisma/client";
export declare class CreateTaskDto {
    title: string;
    description?: string;
    assigneeId?: number;
    priority?: Priority;
    dueDate?: string;
    isAiGenerated?: boolean;
    sprint?: string;
    status?: string;
}
export declare class UpdateTaskStatusDto {
    status: string;
}
