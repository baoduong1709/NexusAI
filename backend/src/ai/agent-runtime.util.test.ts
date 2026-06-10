import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  shouldReportToolRoundLimit,
  truncateAgentMessages,
} from "./agent-runtime.util";

describe("truncateAgentMessages", () => {
  it("keeps tool calls and all matching tool results in the same recent turn", () => {
    const messages = [
      { role: "system", content: "system" },
      { role: "user", content: "old request".repeat(30) },
      { role: "assistant", content: "old answer".repeat(30) },
      { role: "user", content: "inspect project" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "call-1", function: { name: "get_project_tasks" } },
          { id: "call-2", function: { name: "get_project_members" } },
        ],
      },
      { role: "tool", tool_call_id: "call-1", content: "tasks" },
      { role: "tool", tool_call_id: "call-2", content: "members" },
      { role: "assistant", content: "final answer" },
    ];

    const result = truncateAgentMessages(messages, 100, 3, 1);

    assert.equal(result.truncatedCount, 2);
    assert.deepEqual(result.trimmed, [messages[0], ...messages.slice(3)]);
  });

  it("drops an old tool turn as a complete unit", () => {
    const messages = [
      { role: "system", content: "system" },
      { role: "user", content: "old tool request".repeat(20) },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "old-call", function: { name: "old_tool" } }],
      },
      { role: "tool", tool_call_id: "old-call", content: "old result" },
      { role: "assistant", content: "old final answer" },
      { role: "user", content: "new request" },
      { role: "assistant", content: "new answer" },
    ];

    const result = truncateAgentMessages(messages, 40, 3, 1);

    assert.deepEqual(result.trimmed, [messages[0], ...messages.slice(5)]);
    assert.equal(
      result.trimmed.some((message) => message.role === "tool"),
      false,
    );
  });
});

describe("shouldReportToolRoundLimit", () => {
  it("does not report a limit when the final answer completes on the last round", () => {
    assert.equal(
      shouldReportToolRoundLimit({
        completedWithFinalResponse: true,
        clientDisconnected: false,
        loopCount: 5,
        maxRounds: 5,
      }),
      false,
    );
  });

  it("reports a limit when all rounds were consumed by tool calls", () => {
    assert.equal(
      shouldReportToolRoundLimit({
        completedWithFinalResponse: false,
        clientDisconnected: false,
        loopCount: 5,
        maxRounds: 5,
      }),
      true,
    );
  });

  it("does not write a limit message after the client disconnects", () => {
    assert.equal(
      shouldReportToolRoundLimit({
        completedWithFinalResponse: false,
        clientDisconnected: true,
        loopCount: 5,
        maxRounds: 5,
      }),
      false,
    );
  });
});
