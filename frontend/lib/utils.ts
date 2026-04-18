import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const PRIORITY_COLORS = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const TASK_STATUS_COLOR_PALETTE = [
  "#475569",
  "#2563EB",
  "#D97706",
  "#7C3AED",
  "#059669",
  "#DC2626",
];

export interface TaskWorkflowNode {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface TaskWorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface TaskWorkflow {
  nodes: TaskWorkflowNode[];
  edges: TaskWorkflowEdge[];
}

function normalizeWorkflowColor(color: unknown, index: number) {
  if (typeof color === "string" && /^#([0-9a-fA-F]{6})$/.test(color.trim())) {
    return color.trim().toUpperCase();
  }
  return TASK_STATUS_COLOR_PALETTE[index % TASK_STATUS_COLOR_PALETTE.length];
}

function getTextColorForBackground(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#0F172A" : "#FFFFFF";
}

export function createDefaultTaskWorkflow(statuses: string[] = ["TODO", "IN_PROGRESS", "DONE"]): TaskWorkflow {
  const nodes = statuses.map((status, index) => ({
    id: `status-${index + 1}`,
    name: status,
    color: normalizeWorkflowColor(undefined, index),
    x: 80 + index * 220,
    y: 180,
  }));

  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `${node.id}-${nodes[index + 1].id}-${index + 1}`,
    source: node.id,
    target: nodes[index + 1].id,
  }));

  return { nodes, edges };
}

export function normalizeTaskWorkflow(
  workflow: any,
  fallbackStatuses: string[] = [],
): TaskWorkflow {
  const statuses =
    fallbackStatuses.length > 0 ? fallbackStatuses : ["TODO", "IN_PROGRESS", "DONE"];
  const defaultWorkflow = createDefaultTaskWorkflow(statuses);

  if (!workflow || typeof workflow !== "object" || !Array.isArray(workflow.nodes)) {
    return defaultWorkflow;
  }

  const nodes = workflow.nodes
    .map((node: any, index: number) => ({
      id:
        typeof node?.id === "string" && node.id.trim()
          ? node.id.trim()
          : `status-${index + 1}`,
      name: typeof node?.name === "string" ? node.name.trim() : "",
      color: normalizeWorkflowColor(node?.color, index),
      x: typeof node?.x === "number" ? node.x : 80 + index * 220,
      y: typeof node?.y === "number" ? node.y : 180,
    }))
    .filter((node: TaskWorkflowNode) => node.name);

  if (!nodes.length) return defaultWorkflow;

  const nodeIds = new Set(nodes.map((node: TaskWorkflowNode) => node.id));
  const edgeKeys = new Set<string>();
  const edges = (Array.isArray(workflow.edges) ? workflow.edges : [])
    .map((edge: any, index: number) => ({
      id:
        typeof edge?.id === "string" && edge.id.trim()
          ? edge.id.trim()
          : `edge-${index + 1}`,
      source: typeof edge?.source === "string" ? edge.source.trim() : "",
      target: typeof edge?.target === "string" ? edge.target.trim() : "",
    }))
    .filter(
      (edge: TaskWorkflowEdge) =>
        edge.source &&
        edge.target &&
        nodeIds.has(edge.source) &&
        nodeIds.has(edge.target),
    )
    .filter((edge: TaskWorkflowEdge) => {
      const key = `${edge.source}:${edge.target}`;
      if (edgeKeys.has(key)) return false;
      edgeKeys.add(key);
      return true;
    });

  return { nodes, edges };
}

export function getTaskWorkflowNode(
  status: string,
  workflow: TaskWorkflow,
) {
  return workflow.nodes.find((node) => node.name === status) ?? null;
}

export function getTaskStatusInlineStyle(
  status: string,
  workflow: TaskWorkflow,
) {
  const node = getTaskWorkflowNode(status, workflow);
  const color = node?.color ?? TASK_STATUS_COLOR_PALETTE[0];

  return {
    backgroundColor: color,
    color: getTextColorForBackground(color),
    borderColor: color,
  };
}

export function getTaskStatusColorClass() {
  return "border";
}

export function getAllowedTransitionStatuses(
  workflow: TaskWorkflow,
  currentStatus: string,
) {
  const currentNode = getTaskWorkflowNode(currentStatus, workflow);
  if (!currentNode) {
    return workflow.nodes.map((node) => node.name);
  }

  if (!workflow.edges.length) {
    return workflow.nodes.map((node) => node.name);
  }

  const outgoingTargets = workflow.edges
    .filter((edge) => edge.source === currentNode.id)
    .map((edge) => workflow.nodes.find((node) => node.id === edge.target)?.name)
    .filter((name): name is string => Boolean(name));

  return Array.from(new Set([currentStatus, ...outgoingTargets]));
}

export const PROJECT_STATUS_COLORS = {
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

