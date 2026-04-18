import { BadRequestException } from "@nestjs/common";

export const DEFAULT_TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];

const DEFAULT_NODE_COLORS = ["#475569", "#2563eb", "#0f766e", "#ea580c", "#7c3aed"];

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

function normalizeColor(color: string | undefined, index: number) {
  const trimmed = color?.trim();
  if (trimmed && /^#([0-9a-fA-F]{6})$/.test(trimmed)) return trimmed.toUpperCase();
  return DEFAULT_NODE_COLORS[index % DEFAULT_NODE_COLORS.length];
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createNodeId(index: number) {
  return `status-${index + 1}`;
}

function createEdgeId(source: string, target: string, index: number) {
  return `${source}-${target}-${index + 1}`;
}

export function normalizeTaskStatuses(statuses?: string[]) {
  const normalized = (statuses?.length ? statuses : DEFAULT_TASK_STATUSES)
    .map((status) => status?.trim())
    .filter((status): status is string => Boolean(status));

  if (!normalized.length) {
    throw new BadRequestException("Project workflow must contain at least 1 status");
  }

  const unique = new Set(normalized.map((status) => status.toLowerCase()));
  if (unique.size !== normalized.length) {
    throw new BadRequestException("Project workflow statuses must be unique");
  }

  return normalized;
}

export function createDefaultTaskWorkflow(
  statuses: string[] = DEFAULT_TASK_STATUSES,
): ProjectWorkflow {
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

export function normalizeTaskWorkflow(
  workflow: unknown,
  fallbackStatuses?: string[],
): ProjectWorkflow {
  const defaultWorkflow = createDefaultTaskWorkflow(fallbackStatuses);

  if (
    !workflow ||
    typeof workflow !== "object" ||
    !Array.isArray((workflow as any).nodes)
  ) {
    return defaultWorkflow;
  }

  const rawNodes = (workflow as any).nodes as any[];
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

  const uniqueNames = new Set<string>();
  for (const node of normalizedNodes) {
    const key = node.name.toLowerCase();
    if (uniqueNames.has(key)) {
      throw new BadRequestException(
        `Project workflow contains duplicate status name "${node.name}"`,
      );
    }
    uniqueNames.add(key);
  }

  const uniqueIds = new Set<string>();
  const nodes = normalizedNodes.map((node, index) => {
    let nextId = node.id;
    while (uniqueIds.has(nextId)) {
      nextId = `${node.id}-${index + 1}`;
    }
    uniqueIds.add(nextId);
    return { ...node, id: nextId };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const rawEdges = Array.isArray((workflow as any).edges)
    ? ((workflow as any).edges as any[])
    : [];
  const uniqueEdges = new Set<string>();
  const edges = rawEdges
    .map((edge, index) => ({
      id:
        typeof edge?.id === "string" && edge.id.trim()
          ? edge.id.trim()
          : createEdgeId(edge?.source ?? "source", edge?.target ?? "target", index),
      source: typeof edge?.source === "string" ? edge.source.trim() : "",
      target: typeof edge?.target === "string" ? edge.target.trim() : "",
    }))
    .filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .filter((edge) => {
      const key = `${edge.source}:${edge.target}`;
      if (uniqueEdges.has(key)) return false;
      uniqueEdges.add(key);
      return true;
    });

  return { nodes, edges };
}

export function getTaskWorkflowStatusNames(workflow: ProjectWorkflow) {
  return workflow.nodes.map((node) => node.name);
}

export function getDefaultTaskStatus(workflow: ProjectWorkflow) {
  return workflow.nodes[0]?.name ?? DEFAULT_TASK_STATUSES[0];
}

export function buildWorkflowRenameMap(
  currentWorkflow: ProjectWorkflow,
  nextWorkflow: ProjectWorkflow,
) {
  const nextNodesById = new Map(nextWorkflow.nodes.map((node) => [node.id, node]));

  return currentWorkflow.nodes
    .map((node) => {
      const nextNode = nextNodesById.get(node.id);
      if (!nextNode || nextNode.name === node.name) return null;
      return { from: node.name, to: nextNode.name };
    })
    .filter((mapping): mapping is { from: string; to: string } => Boolean(mapping));
}

export function isTaskTransitionAllowed(
  workflow: ProjectWorkflow,
  fromStatus: string,
  toStatus: string,
) {
  if (fromStatus === toStatus) return true;
  if (!workflow.edges.length) return true;

  const sourceNode = workflow.nodes.find((node) => node.name === fromStatus);
  const targetNode = workflow.nodes.find((node) => node.name === toStatus);

  if (!sourceNode || !targetNode) return false;

  return workflow.edges.some(
    (edge) => edge.source === sourceNode.id && edge.target === targetNode.id,
  );
}

export function getWorkflowAsJson(workflow: ProjectWorkflow) {
  return workflow as unknown as Record<string, unknown>;
}
