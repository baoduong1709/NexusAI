"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TASK_STATUSES = void 0;
exports.normalizeTaskStatuses = normalizeTaskStatuses;
exports.createDefaultTaskWorkflow = createDefaultTaskWorkflow;
exports.normalizeTaskWorkflow = normalizeTaskWorkflow;
exports.getTaskWorkflowStatusNames = getTaskWorkflowStatusNames;
exports.getDefaultTaskStatus = getDefaultTaskStatus;
exports.buildWorkflowRenameMap = buildWorkflowRenameMap;
exports.isTaskTransitionAllowed = isTaskTransitionAllowed;
exports.getWorkflowAsJson = getWorkflowAsJson;
const common_1 = require("@nestjs/common");
exports.DEFAULT_TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const DEFAULT_NODE_COLORS = ["#475569", "#2563eb", "#0f766e", "#ea580c", "#7c3aed"];
function normalizeColor(color, index) {
    const trimmed = color?.trim();
    if (trimmed && /^#([0-9a-fA-F]{6})$/.test(trimmed))
        return trimmed.toUpperCase();
    return DEFAULT_NODE_COLORS[index % DEFAULT_NODE_COLORS.length];
}
function normalizeNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function createNodeId(index) {
    return `status-${index + 1}`;
}
function createEdgeId(source, target, index) {
    return `${source}-${target}-${index + 1}`;
}
function normalizeTaskStatuses(statuses) {
    const normalized = (statuses?.length ? statuses : exports.DEFAULT_TASK_STATUSES)
        .map((status) => status?.trim())
        .filter((status) => Boolean(status));
    if (!normalized.length) {
        throw new common_1.BadRequestException("Project workflow must contain at least 1 status");
    }
    const unique = new Set(normalized.map((status) => status.toLowerCase()));
    if (unique.size !== normalized.length) {
        throw new common_1.BadRequestException("Project workflow statuses must be unique");
    }
    return normalized;
}
function createDefaultTaskWorkflow(statuses = exports.DEFAULT_TASK_STATUSES) {
    const normalizedStatuses = normalizeTaskStatuses(statuses);
    const nodes = normalizedStatuses.map((status, index) => ({
        id: createNodeId(index),
        name: status,
        color: normalizeColor(undefined, index),
        x: 80 + index * 220,
        y: 180,
    }));
    const edges = nodes.slice(0, -1).map((node, index) => ({
        id: createEdgeId(node.id, nodes[index + 1].id, index),
        source: node.id,
        target: nodes[index + 1].id,
    }));
    return { nodes, edges };
}
function normalizeTaskWorkflow(workflow, fallbackStatuses) {
    const defaultWorkflow = createDefaultTaskWorkflow(fallbackStatuses);
    if (!workflow ||
        typeof workflow !== "object" ||
        !Array.isArray(workflow.nodes)) {
        return defaultWorkflow;
    }
    const rawNodes = workflow.nodes;
    const normalizedNodes = rawNodes
        .map((node, index) => ({
        id: typeof node?.id === "string" && node.id.trim() ? node.id.trim() : createNodeId(index),
        name: typeof node?.name === "string" ? node.name.trim() : "",
        color: normalizeColor(node?.color, index),
        x: normalizeNumber(node?.x, 80 + index * 220),
        y: normalizeNumber(node?.y, 180),
    }))
        .filter((node) => node.name);
    if (!normalizedNodes.length) {
        return defaultWorkflow;
    }
    const uniqueNames = new Set();
    for (const node of normalizedNodes) {
        const key = node.name.toLowerCase();
        if (uniqueNames.has(key)) {
            throw new common_1.BadRequestException(`Project workflow contains duplicate status name "${node.name}"`);
        }
        uniqueNames.add(key);
    }
    const uniqueIds = new Set();
    const nodes = normalizedNodes.map((node, index) => {
        let nextId = node.id;
        while (uniqueIds.has(nextId)) {
            nextId = `${node.id}-${index + 1}`;
        }
        uniqueIds.add(nextId);
        return { ...node, id: nextId };
    });
    const nodeIds = new Set(nodes.map((node) => node.id));
    const rawEdges = Array.isArray(workflow.edges)
        ? workflow.edges
        : [];
    const uniqueEdges = new Set();
    const edges = rawEdges
        .map((edge, index) => ({
        id: typeof edge?.id === "string" && edge.id.trim()
            ? edge.id.trim()
            : createEdgeId(edge?.source ?? "source", edge?.target ?? "target", index),
        source: typeof edge?.source === "string" ? edge.source.trim() : "",
        target: typeof edge?.target === "string" ? edge.target.trim() : "",
    }))
        .filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .filter((edge) => {
        const key = `${edge.source}:${edge.target}`;
        if (uniqueEdges.has(key))
            return false;
        uniqueEdges.add(key);
        return true;
    });
    return { nodes, edges };
}
function getTaskWorkflowStatusNames(workflow) {
    return workflow.nodes.map((node) => node.name);
}
function getDefaultTaskStatus(workflow) {
    return workflow.nodes[0]?.name ?? exports.DEFAULT_TASK_STATUSES[0];
}
function buildWorkflowRenameMap(currentWorkflow, nextWorkflow) {
    const nextNodesById = new Map(nextWorkflow.nodes.map((node) => [node.id, node]));
    return currentWorkflow.nodes
        .map((node) => {
        const nextNode = nextNodesById.get(node.id);
        if (!nextNode || nextNode.name === node.name)
            return null;
        return { from: node.name, to: nextNode.name };
    })
        .filter((mapping) => Boolean(mapping));
}
function isTaskTransitionAllowed(workflow, fromStatus, toStatus) {
    if (fromStatus === toStatus)
        return true;
    if (!workflow.edges.length)
        return true;
    const sourceNode = workflow.nodes.find((node) => node.name === fromStatus);
    const targetNode = workflow.nodes.find((node) => node.name === toStatus);
    if (!sourceNode || !targetNode)
        return false;
    return workflow.edges.some((edge) => edge.source === sourceNode.id && edge.target === targetNode.id);
}
function getWorkflowAsJson(workflow) {
    return workflow;
}
//# sourceMappingURL=project-workflow.js.map