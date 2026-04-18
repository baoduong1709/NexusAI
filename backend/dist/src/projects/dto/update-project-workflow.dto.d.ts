declare class WorkflowNodeDto {
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
}
declare class WorkflowEdgeDto {
    id: string;
    source: string;
    target: string;
}
export declare class UpdateProjectWorkflowDto {
    nodes: WorkflowNodeDto[];
    edges?: WorkflowEdgeDto[];
}
export {};
