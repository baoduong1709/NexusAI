declare class ConfirmTaskDto {
    title: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH";
    assigneeId?: number;
    dueDate?: string;
    sprint?: string;
}
export declare class ConfirmAiTasksDto {
    tasks: ConfirmTaskDto[];
}
export declare class SuggestAssigneeDto {
    taskDescription: string;
}
declare class ChatMessageDto {
    role: "user" | "assistant";
    content: string;
}
export declare class AiChatDto {
    messages: ChatMessageDto[];
}
export {};
