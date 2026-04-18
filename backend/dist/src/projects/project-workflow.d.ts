export declare const DEFAULT_TASK_STATUSES: string[];
export interface ProjectWorkflowNode {
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
}
export interface ProjectWorkflowEdge {
    id: string;
    source: string;
    target: string;
}
export interface ProjectWorkflow {
    nodes: ProjectWorkflowNode[];
    edges: ProjectWorkflowEdge[];
}
export declare function normalizeTaskStatuses(statuses?: string[]): string[];
export declare function createDefaultTaskWorkflow(statuses?: string[]): ProjectWorkflow;
export declare function normalizeTaskWorkflow(workflow: unknown, fallbackStatuses?: string[]): ProjectWorkflow;
export declare function getTaskWorkflowStatusNames(workflow: ProjectWorkflow): string[];
export declare function getDefaultTaskStatus(workflow: ProjectWorkflow): string;
export declare function buildWorkflowRenameMap(currentWorkflow: ProjectWorkflow, nextWorkflow: ProjectWorkflow): {
    from: string;
    to: string;
}[];
export declare function isTaskTransitionAllowed(workflow: ProjectWorkflow, fromStatus: string, toStatus: string): boolean;
export declare function getWorkflowAsJson(workflow: ProjectWorkflow): Record<string, unknown>;
