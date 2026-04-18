export declare class CreateProjectDto {
    name: string;
    description?: string;
    budget?: number;
    startDate?: string;
    endDate?: string;
    memberIds?: number[];
    projectRoles?: string[];
    taskStatuses?: string[];
}
