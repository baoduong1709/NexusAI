import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { validateTaskSuggestionPayload } from "./task-suggestion.util";

describe("validateTaskSuggestionPayload", () => {
  it("normalizes a valid structured task suggestion", () => {
    const result = validateTaskSuggestionPayload({
      message: "📋 Đề xuất 1 task.",
      tasks: [
        {
          title: "Implement login API",
          description: "Acceptance criteria",
          priority: "high",
          dueDate: null,
          labels: ["BE", " auth ", 123],
          estimateHours: "8",
          loggedHours: -2,
          assigneeId: "12",
        },
      ],
    });

    assert.equal(result.tasks[0].priority, "HIGH");
    assert.equal(result.message, "Đề xuất 1 task.");
    assert.deepEqual(result.tasks[0].labels, ["BE", "auth"]);
    assert.equal(result.tasks[0].estimateHours, 8);
    assert.equal(result.tasks[0].loggedHours, 0);
    assert.equal(result.tasks[0].assigneeId, 12);
  });

  it("rejects malformed payloads instead of silently losing tasks", () => {
    assert.throws(
      () => validateTaskSuggestionPayload({ message: "Missing tasks" }),
      /at least one task/,
    );
    assert.throws(
      () =>
        validateTaskSuggestionPayload({
          message: "Invalid date",
          tasks: [{ title: "Task", dueDate: "tomorrow" }],
        }),
      /invalid dueDate/,
    );
  });
});
