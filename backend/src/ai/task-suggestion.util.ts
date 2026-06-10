export interface ValidatedSuggestedTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string;
  epic?: string;
  labels: string[];
  sprint?: string;
  estimateHours: number;
  loggedHours: number;
  assigneeId: number | null;
}

export interface ValidatedTaskSuggestionPayload {
  message: string;
  tasks: ValidatedSuggestedTask[];
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.toLowerCase() !== "null"
    ? normalized
    : undefined;
}

function nonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sanitizeUserFacingMessage(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function validateTaskSuggestionPayload(
  value: unknown,
): ValidatedTaskSuggestionPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Task suggestion payload must be an object");
  }

  const payload = value as Record<string, unknown>;
  const rawMessage = optionalString(payload.message);
  if (!rawMessage) {
    throw new Error("Task suggestion payload requires a message");
  }
  const message = sanitizeUserFacingMessage(rawMessage);
  if (!Array.isArray(payload.tasks) || payload.tasks.length === 0) {
    throw new Error("Task suggestion payload requires at least one task");
  }
  if (payload.tasks.length > 50) {
    throw new Error("A single suggestion may contain at most 50 tasks");
  }

  const tasks = payload.tasks.map((rawTask, index) => {
    if (!rawTask || typeof rawTask !== "object") {
      throw new Error(`Task ${index + 1} must be an object`);
    }

    const task = rawTask as Record<string, unknown>;
    const title = optionalString(task.title);
    if (!title) {
      throw new Error(`Task ${index + 1} requires a title`);
    }

    const rawPriority = String(task.priority || "MEDIUM").toUpperCase();
    const priority = ["LOW", "MEDIUM", "HIGH"].includes(rawPriority)
      ? (rawPriority as "LOW" | "MEDIUM" | "HIGH")
      : "MEDIUM";
    const dueDate = optionalString(task.dueDate);
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new Error(`Task ${index + 1} has an invalid dueDate`);
    }

    return {
      title,
      description: optionalString(task.description) || "",
      priority,
      dueDate,
      epic: optionalString(task.epic),
      labels: Array.isArray(task.labels)
        ? task.labels
            .filter((label): label is string => typeof label === "string")
            .map((label) => label.trim())
            .filter(Boolean)
        : [],
      sprint: optionalString(task.sprint),
      estimateHours: nonNegativeNumber(task.estimateHours),
      loggedHours: nonNegativeNumber(task.loggedHours),
      assigneeId:
        task.assigneeId === null || task.assigneeId === undefined
          ? null
          : Number.isInteger(Number(task.assigneeId))
            ? Number(task.assigneeId)
            : null,
    };
  });

  return { message, tasks };
}
