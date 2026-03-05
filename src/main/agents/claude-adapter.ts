import type { AgentEvent, AgentEventType } from "../../shared/agent-types.js";

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";

interface ClaudeAdapterOptions {
  sessionId: string;
  worktreePath: string;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
}

export class ClaudeAdapter {
  private sessionId: string;
  private worktreePath: string;
  private agentSessionId: string | null = null;
  private allowedTools: string[];
  private permissionMode: PermissionMode;

  constructor(options: ClaudeAdapterOptions) {
    this.sessionId = options.sessionId;
    this.worktreePath = options.worktreePath;
    this.allowedTools = options.allowedTools ?? [];
    this.permissionMode = options.permissionMode ?? "default";
  }

  buildStartArgs(prompt: string): string[] {
    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--session-id",
      this.sessionId,
    ];
    this.appendPermissionArgs(args);
    return args;
  }

  buildResumeArgs(prompt: string): string[] {
    if (!this.agentSessionId) {
      throw new Error("Cannot resume without an agent session ID");
    }
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--resume", this.agentSessionId];
    this.appendPermissionArgs(args);
    return args;
  }

  private appendPermissionArgs(args: string[]): void {
    if (this.permissionMode !== "default") {
      args.push("--permission-mode", this.permissionMode);
    }
    if (this.allowedTools.length > 0) {
      args.push("--allowedTools", ...this.allowedTools);
    }
  }

  /**
   * Parse a single NDJSON line into zero or one event.
   * For lines that produce multiple events, use parseLines() instead.
   */
  parseLine(line: Record<string, unknown>): AgentEvent | null {
    const events = this.parseLines([line]);
    return events.length > 0 ? events[0] : null;
  }

  /**
   * Parse one or more NDJSON lines into events.
   * A single line can produce multiple events (e.g., assistant message
   * with tool_use blocks yields one tool_use_start per block plus message_complete).
   */
  parseLines(lines: Record<string, unknown>[]): AgentEvent[] {
    const events: AgentEvent[] = [];
    for (const line of lines) {
      const messageType = line.type as string;

      switch (messageType) {
        case "system": {
          const event = this.parseSystemMessage(line);
          if (event) events.push(event);
          break;
        }
        case "stream_event": {
          const event = this.parseStreamEvent(line);
          if (event) events.push(event);
          break;
        }
        case "assistant":
          events.push(...this.parseAssistantMessage(line));
          break;
        case "user":
          events.push(...this.parseUserMessage(line));
          break;
        case "tool_use_summary": {
          const summary = line.summary as string | undefined;
          if (summary) {
            events.push(this.makeEvent("tool_use_summary", { summary }));
          }
          break;
        }
        case "result": {
          const event = this.parseResultMessage(line);
          events.push(event);
          break;
        }
      }
    }
    return events;
  }

  setAgentSessionId(agentSessionId: string): void {
    this.agentSessionId = agentSessionId;
  }

  getAgentSessionId(): string | null {
    return this.agentSessionId;
  }

  private makeEvent(type: AgentEventType, data: Record<string, unknown>): AgentEvent {
    return {
      type,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      data,
    };
  }

  private parseSystemMessage(line: Record<string, unknown>): AgentEvent | null {
    if (line.subtype !== "init") return null;

    const agentSessionId = line.session_id as string;
    this.agentSessionId = agentSessionId;

    return this.makeEvent("session_start", {
      agentSessionId,
      tools: line.tools ?? [],
      mcpServers: line.mcp_servers ?? [],
    });
  }

  private parseStreamEvent(line: Record<string, unknown>): AgentEvent | null {
    const event = line.event as Record<string, unknown> | undefined;
    if (!event) return null;

    const eventType = event.type as string;

    if (eventType === "content_block_delta") {
      return this.parseDelta(event);
    }

    if (eventType === "content_block_start") {
      return this.parseContentBlockStart(event);
    }

    return null;
  }

  private parseDelta(event: Record<string, unknown>): AgentEvent | null {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (!delta) return null;

    const deltaType = delta.type as string;

    if (deltaType === "text_delta") {
      return this.makeEvent("text_delta", { text: delta.text });
    }

    if (deltaType === "input_json_delta") {
      return this.makeEvent("tool_use_delta", { partialJson: delta.partial_json });
    }

    if (deltaType === "thinking_delta") {
      return this.makeEvent("thinking_delta", { text: delta.thinking });
    }

    return null;
  }

  private parseContentBlockStart(event: Record<string, unknown>): AgentEvent | null {
    const contentBlock = event.content_block as Record<string, unknown> | undefined;
    if (!contentBlock) return null;

    if (contentBlock.type === "tool_use") {
      return this.makeEvent("tool_use_start", {
        toolId: contentBlock.id,
        toolName: contentBlock.name,
      });
    }

    if (contentBlock.type === "thinking") {
      return this.makeEvent("thinking_delta", { text: contentBlock.thinking ?? "" });
    }

    return null;
  }

  private parseAssistantMessage(line: Record<string, unknown>): AgentEvent[] {
    const message = line.message as Record<string, unknown>;
    const content = message.content as Array<Record<string, unknown>>;
    const events: AgentEvent[] = [];

    // Emit tool_use_start for each tool_use block
    for (const block of content) {
      if (block.type === "tool_use") {
        events.push(this.makeEvent("tool_use_start", {
          toolId: block.id,
          toolName: block.name,
          toolInput: block.input,
        }));
      }
    }

    // Always emit message_complete with full content
    events.push(this.makeEvent("message_complete", {
      content: message.content,
      stopReason: message.stop_reason,
      model: message.model,
    }));

    return events;
  }

  private parseUserMessage(line: Record<string, unknown>): AgentEvent[] {
    const message = line.message as Record<string, unknown> | undefined;
    if (!message) return [];

    const content = message.content as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(content)) return [];

    const events: AgentEvent[] = [];
    for (const block of content) {
      if (block.type === "tool_result") {
        events.push(this.makeEvent("tool_result", {
          toolId: block.tool_use_id,
          content: block.content,
        }));
      }
    }
    return events;
  }

  private parseResultMessage(line: Record<string, unknown>): AgentEvent {
    const isError = line.is_error as boolean;

    if (isError) {
      return this.makeEvent("error", {
        message: line.result as string,
      });
    }

    return this.makeEvent("session_end", {
      result: line.result,
      isError: false,
      totalCostUsd: line.total_cost_usd,
      usage: line.usage,
    });
  }
}
