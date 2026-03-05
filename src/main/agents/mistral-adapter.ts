import type { AgentEvent, AgentEventType } from "../../shared/agent-types.js";

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";

interface MistralAdapterOptions {
  sessionId: string;
  worktreePath: string;
  allowedTools?: string[];
  additionalDirs?: string[];
  permissionMode?: PermissionMode;
}

export class MistralAdapter {
  private sessionId: string;
  private worktreePath: string;
  private agentSessionId: string | null = null;
  private allowedTools: string[];
  private additionalDirs: string[];
  private permissionMode: PermissionMode;
  private seenMessageIds = new Set<string>();

  constructor(options: MistralAdapterOptions) {
    this.sessionId = options.sessionId;
    this.worktreePath = options.worktreePath;
    this.allowedTools = options.allowedTools ?? [];
    this.additionalDirs = options.additionalDirs ?? [];
    this.permissionMode = options.permissionMode ?? "default";
  }

  buildStartArgs(prompt: string): string[] {
    // vibe CLI uses -p for programmatic mode, --output streaming for NDJSON format
    // Format: vibe -p "prompt" --output streaming [--agent agentName] [--enabled-tools tool1]
    // Note: vibe doesn't support --session-id for new sessions like claude does
    // Also note: vibe expects task-oriented prompts, so we add context
    const args = ["-p", `"${prompt}"`, "--output", "streaming"];
    this.appendPermissionArgs(args);
    return args;
  }

  buildResumeArgs(prompt: string): string[] {
    if (!this.agentSessionId) {
      throw new Error("Cannot resume without an agent session ID");
    }
    // Use --resume for specific session ID continuation
    // Make resume prompts task-oriented as well
    const args = ["-p", `"${prompt}"`, "--output", "streaming", "--resume", this.agentSessionId];
    this.appendPermissionArgs(args);
    return args;
  }

  private appendPermissionArgs(args: string[]): void {
    // Map permission modes to vibe agent names
    if (this.permissionMode !== "default") {
      const vibeAgentName = this.mapPermissionModeToAgent(this.permissionMode);
      args.push("--agent", vibeAgentName);
    }

    // vibe uses --enabled-tools instead of --allowed-tools
    if (this.allowedTools.length > 0) {
      for (const tool of this.allowedTools) {
        args.push("--enabled-tools", tool);
      }
    }

    // vibe doesn't have a direct --add-dir equivalent, but --workdir can be used
    // For now, we'll skip additional dirs or handle them differently
    // Note: This might need adjustment based on actual vibe behavior
  }

  private mapPermissionModeToAgent(permissionMode: PermissionMode): string {
    // Map our permission modes to vibe's built-in agent names
    switch (permissionMode) {
      case "acceptEdits":
        return "accept-edits";
      case "bypassPermissions":
        return "auto-approve";
      case "plan":
        return "plan";
      case "default":
        return "accept-edits"; // More specific than "default"
      default:
        return "accept-edits";
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
   * vibe CLI can produce either:
   * 1. JSON format: {"role": "system", "content": "..."} or {"role": "assistant", "content": "..."}
   * 2. Plain text format: "response text"
   */
  parseLines(lines: Record<string, unknown>[]): AgentEvent[] {
    const events: AgentEvent[] = [];
    for (const line of lines) {
      // Check if this is the simple vibe format with role/content
      if ("role" in line && "content" in line) {
        // Skip replayed messages from resumed sessions
        const messageId = line.message_id as string | undefined;
        if (messageId) {
          if (this.seenMessageIds.has(messageId)) continue;
          this.seenMessageIds.add(messageId);
        }

        const role = line.role as string;
        const content = line.content as string;

        switch (role) {
          case "system":
            // System messages are treated as session initialization
            if (!this.agentSessionId) {
              // Generate a temporary session ID for vibe
              this.agentSessionId = `vibe-${Date.now()}`;
            }
            events.push(
              this.makeEvent("session_start", {
                agentSessionId: this.agentSessionId,
                tools: [], // vibe doesn't expose tools in system message
                mcpServers: [],
              }),
            );
            events.push(
              this.makeEvent("text_complete", {
                text: content,
              }),
            );
            break;

          case "assistant":
            // Assistant messages contain the actual response
            events.push(
              this.makeEvent("text_delta", {
                text: content,
              }),
            );
            events.push(
              this.makeEvent("text_complete", {
                text: content,
              }),
            );
            events.push(
              this.makeEvent("message_complete", {
                content,
              }),
            );
            break;

          case "user":
            // User messages would be echoed back
            events.push(
              this.makeEvent("text_complete", {
                text: content,
              }),
            );
            break;
        }
        continue;
      }

      // Fallback to claude-style parsing for compatibility
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
        case "control_request": {
          const event = this.parseControlRequest(line);
          if (event) events.push(event);
          break;
        }
        case "result": {
          const event = this.parseResultMessage(line);
          if (event) events.push(event);
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
        events.push(
          this.makeEvent("tool_use_start", {
            toolId: block.id,
            toolName: block.name,
            toolInput: block.input,
          }),
        );
      }
    }

    // Always emit message_complete with full content
    events.push(
      this.makeEvent("message_complete", {
        content: message.content,
        stopReason: message.stop_reason,
        model: message.model,
      }),
    );

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
        const toolResultContent = block.content as string | undefined;
        events.push(
          this.makeEvent("tool_result", {
            toolId: block.tool_use_id,
            content: toolResultContent,
          }),
        );

        // Detect directory permission denials
        const deniedEvent = this.detectDirectoryPermissionDenied(toolResultContent);
        if (deniedEvent) events.push(deniedEvent);
      }
    }
    return events;
  }

  private detectDirectoryPermissionDenied(content: string | undefined): AgentEvent | null {
    if (typeof content !== "string") return null;
    const match = content.match(/requested permissions to (?:read|write) from (.+?)(?:,|$)/);
    if (!match) return null;
    return this.makeEvent("directory_permission_denied", { path: match[1].trim() });
  }

  private parseControlRequest(line: Record<string, unknown>): AgentEvent | null {
    const requestId = line.request_id as string;
    const request = line.request as Record<string, unknown> | undefined;
    if (!request || request.subtype !== "can_use_tool") return null;

    return this.makeEvent("permission_request", {
      requestId,
      toolName: request.tool_name as string,
      toolInput: request.input as Record<string, unknown>,
    });
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
