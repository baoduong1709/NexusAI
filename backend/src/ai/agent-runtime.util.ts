export interface AgentRuntimeMessage {
  role: string;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: string;
  [key: string]: unknown;
}

function estimateMessageTokens(
  message: AgentRuntimeMessage,
  charsPerToken: number,
): number {
  let total = 0;

  if (typeof message.content === "string") {
    total += Math.ceil(message.content.length / charsPerToken);
  }
  if (message.tool_calls) {
    total += Math.ceil(
      JSON.stringify(message.tool_calls).length / charsPerToken,
    );
  }

  return total;
}

export function estimateAgentMessageTokens(
  messages: AgentRuntimeMessage[],
  charsPerToken = 3,
): number {
  return messages.reduce(
    (total, message) =>
      total + estimateMessageTokens(message, charsPerToken),
    0,
  );
}

function groupConversationTurns(
  messages: AgentRuntimeMessage[],
): AgentRuntimeMessage[][] {
  const turns: AgentRuntimeMessage[][] = [];
  let currentTurn: AgentRuntimeMessage[] = [];

  for (const message of messages) {
    if (message.role === "user" && currentTurn.length > 0) {
      turns.push(currentTurn);
      currentTurn = [];
    }
    currentTurn.push(message);
  }

  if (currentTurn.length > 0) {
    turns.push(currentTurn);
  }

  return turns;
}

export function truncateAgentMessages(
  messages: AgentRuntimeMessage[],
  maxTokens: number,
  charsPerToken = 3,
  minimumRecentTurns = 3,
): { trimmed: AgentRuntimeMessage[]; truncatedCount: number } {
  const systemMessages = messages.filter((message) => message.role === "system");
  const conversationMessages = messages.filter(
    (message) => message.role !== "system",
  );
  const availableTokens = Math.max(
    0,
    maxTokens - estimateAgentMessageTokens(systemMessages, charsPerToken),
  );

  if (
    estimateAgentMessageTokens(conversationMessages, charsPerToken) <=
    availableTokens
  ) {
    return { trimmed: messages, truncatedCount: 0 };
  }

  const turns = groupConversationTurns(conversationMessages);
  const keptTurns: AgentRuntimeMessage[][] = [];
  let keptTokens = 0;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const turnTokens = estimateAgentMessageTokens(turn, charsPerToken);
    const mustKeep = keptTurns.length < minimumRecentTurns;

    if (mustKeep || keptTokens + turnTokens <= availableTokens) {
      keptTurns.unshift(turn);
      keptTokens += turnTokens;
      continue;
    }

    break;
  }

  const keptMessages = keptTurns.flat();
  return {
    trimmed: [...systemMessages, ...keptMessages],
    truncatedCount: conversationMessages.length - keptMessages.length,
  };
}

export function shouldReportToolRoundLimit(options: {
  completedWithFinalResponse: boolean;
  clientDisconnected: boolean;
  loopCount: number;
  maxRounds: number;
}): boolean {
  return (
    !options.completedWithFinalResponse &&
    !options.clientDisconnected &&
    options.loopCount >= options.maxRounds
  );
}
