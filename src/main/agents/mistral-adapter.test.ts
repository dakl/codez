import { describe, expect, it } from "vitest";
import { MistralAdapter } from "./mistral-adapter";

describe("MistralAdapter", () => {
  it("builds correct start arguments", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
      allowedTools: ["bash", "grep"],
      additionalDirs: ["/extra/dir"],
      permissionMode: "acceptEdits",
    });

    const args = adapter.buildStartArgs("Hello, world!");

    expect(args).toContain("-p");
    // Note: prompts are now prefixed with "Codebase analysis task: "
    expect(args.some(arg => arg.includes("Codebase analysis task:"))).toBe(true);
    // streaming is now a positional argument, not --output streaming
    expect(args).toContain("streaming");
    // Note: vibe doesn't support --session-id for new sessions like claude does
    expect(args).toContain("--agent");
    expect(args).toContain("accept-edits");
    expect(args).toContain("--enabled-tools");
    expect(args).toContain("bash");
    expect(args).toContain("grep");
    // Note: --add-dir is not directly supported by vibe CLI
  });

  it("builds correct resume arguments", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    // Set agent session ID first
    adapter.setAgentSessionId("agent-session-123");

    const args = adapter.buildResumeArgs("Continue please");

    expect(args).toContain("-p");
    // Note: prompts are now prefixed with "Continue codebase task: "
    expect(args.some(arg => arg.includes("Continue codebase task:"))).toBe(true);
    // streaming is now a positional argument
    expect(args).toContain("streaming");
    expect(args).toContain("--resume");
    expect(args).toContain("agent-session-123");
  });

  it("throws error when resuming without agent session ID", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    expect(() => adapter.buildResumeArgs("test")).toThrow("Cannot resume without an agent session ID");
  });

  it("parses session start events", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "system",
      subtype: "init",
      session_id: "agent-session-456",
      tools: ["bash", "grep"],
      mcp_servers: ["server1"],
    };

    const event = adapter.parseLine(line);
    expect(event).not.toBeNull();
    expect(event?.type).toBe("session_start");
    expect(event?.data.agentSessionId).toBe("agent-session-456");
    expect(adapter.getAgentSessionId()).toBe("agent-session-456");
  });

  it("parses text delta events", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: {
          type: "text_delta",
          text: "Hello",
        },
      },
    };

    const event = adapter.parseLine(line);
    expect(event).not.toBeNull();
    expect(event?.type).toBe("text_delta");
    expect(event?.data.text).toBe("Hello");
  });

  it("parses tool use start events", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "stream_event",
      event: {
        type: "content_block_start",
        content_block: {
          type: "tool_use",
          id: "tool-123",
          name: "bash",
        },
      },
    };

    const event = adapter.parseLine(line);
    expect(event).not.toBeNull();
    expect(event?.type).toBe("tool_use_start");
    expect(event?.data.toolId).toBe("tool-123");
    expect(event?.data.toolName).toBe("bash");
  });

  it("parses message complete events", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "assistant",
      message: {
        content: [
          {
            type: "text",
            text: "Response text",
          },
        ],
        stop_reason: "end_turn",
        model: "mistral-large",
      },
    };

    const events = adapter.parseLines([line]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("message_complete");
    expect(events[0].data.content).toEqual(line.message.content);
    expect(events[0].data.stopReason).toBe("end_turn");
    expect(events[0].data.model).toBe("mistral-large");
  });

  it("parses tool result events", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "tool-456",
            content: "Command output",
          },
        ],
      },
    };

    const events = adapter.parseLines([line]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("tool_result");
    expect(events[0].data.toolId).toBe("tool-456");
    expect(events[0].data.content).toBe("Command output");
  });

  it("parses permission requests", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "control_request",
      request_id: "req-789",
      request: {
        subtype: "can_use_tool",
        tool_name: "bash",
        input: { command: "ls -la" },
      },
    };

    const event = adapter.parseLine(line);
    expect(event).not.toBeNull();
    expect(event?.type).toBe("permission_request");
    expect(event?.data.requestId).toBe("req-789");
    expect(event?.data.toolName).toBe("bash");
    expect(event?.data.toolInput).toEqual({ command: "ls -la" });
  });

  it("parses error events", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "result",
      is_error: true,
      result: "Something went wrong",
    };

    const event = adapter.parseLine(line);
    expect(event).not.toBeNull();
    expect(event?.type).toBe("error");
    expect(event?.data.message).toBe("Something went wrong");
  });

  it("parses session end events", () => {
    const adapter = new MistralAdapter({
      sessionId: "test-session",
      worktreePath: "/test/path",
    });

    const line = {
      type: "result",
      is_error: false,
      result: "Success",
      total_cost_usd: 0.15,
      usage: { input_tokens: 100, output_tokens: 50 },
    };

    const event = adapter.parseLine(line);
    expect(event).not.toBeNull();
    expect(event?.type).toBe("session_end");
    expect(event?.data.result).toBe("Success");
    expect(event?.data.totalCostUsd).toBe(0.15);
  });
});
