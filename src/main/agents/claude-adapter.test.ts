import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ClaudeAdapter } from "./claude-adapter";
import { StreamParser } from "./stream-parser";

const fixturesDir = join(__dirname, "../../__fixtures__");

function loadFixtureEvents(filename: string): Record<string, unknown>[] {
  const raw = readFileSync(join(fixturesDir, filename), "utf-8");
  const parser = new StreamParser();
  return parser.feed(raw);
}

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter({
      sessionId: "test-session-1",
      worktreePath: "/tmp/worktree",
    });
  });

  describe("buildStartArgs", () => {
    it("returns correct flags for a new session", () => {
      const args = adapter.buildStartArgs("Fix the bug");
      expect(args).toContain("-p");
      expect(args).toContain("Fix the bug");
      expect(args).toContain("--output-format");
      expect(args).toContain("stream-json");
      expect(args).toContain("--verbose");
    });

    it("includes session-id flag", () => {
      const args = adapter.buildStartArgs("Hello");
      const sessionIdIndex = args.indexOf("--session-id");
      expect(sessionIdIndex).toBeGreaterThan(-1);
      expect(args[sessionIdIndex + 1]).toBe("test-session-1");
    });

    it("does not include --resume or --continue flags", () => {
      const args = adapter.buildStartArgs("Hello");
      expect(args).not.toContain("--resume");
      expect(args).not.toContain("--continue");
    });
  });

  describe("buildResumeArgs", () => {
    it("returns correct flags for resuming a session", () => {
      adapter.setAgentSessionId("claude-session-abc");
      const args = adapter.buildResumeArgs("Continue working");
      expect(args).toContain("-p");
      expect(args).toContain("Continue working");
      expect(args).toContain("--output-format");
      expect(args).toContain("stream-json");
      expect(args).toContain("--resume");
      expect(args).toContain("claude-session-abc");
    });

    it("throws if no agent session id is set", () => {
      expect(() => adapter.buildResumeArgs("Continue")).toThrow("Cannot resume without an agent session ID");
    });

    it("does not include --session-id flag", () => {
      adapter.setAgentSessionId("claude-session-abc");
      const args = adapter.buildResumeArgs("Continue");
      expect(args).not.toContain("--session-id");
    });
  });

  describe("parseLine", () => {
    it("extracts session_id from system init message", () => {
      const event = adapter.parseLine({
        type: "system",
        subtype: "init",
        session_id: "abc-123",
        tools: [],
        mcp_servers: [],
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("session_start");
      expect(event?.data.agentSessionId).toBe("abc-123");
      expect(event?.data.tools).toEqual([]);
    });

    it("updates internal agent session id on system init", () => {
      adapter.parseLine({
        type: "system",
        subtype: "init",
        session_id: "abc-123",
        tools: [],
        mcp_servers: [],
      });
      expect(adapter.getAgentSessionId()).toBe("abc-123");
    });

    it("maps text_delta stream events", () => {
      const event = adapter.parseLine({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
        session_id: "abc-123",
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("text_delta");
      expect(event?.data.text).toBe("Hello");
    });

    it("maps tool_use content_block_start to tool_use_start", () => {
      const event = adapter.parseLine({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 1,
          content_block: { type: "tool_use", id: "toolu_01", name: "Read", input: {} },
        },
        session_id: "abc-123",
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("tool_use_start");
      expect(event?.data.toolId).toBe("toolu_01");
      expect(event?.data.toolName).toBe("Read");
    });

    it("maps input_json_delta to tool_use_delta", () => {
      const event = adapter.parseLine({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 1,
          delta: { type: "input_json_delta", partial_json: '{"file_path":' },
        },
        session_id: "abc-123",
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("tool_use_delta");
      expect(event?.data.partialJson).toBe('{"file_path":');
    });

    it("maps result message to session_end", () => {
      const event = adapter.parseLine({
        type: "result",
        result: "Done.",
        session_id: "abc-123",
        is_error: false,
        total_cost_usd: 0.001,
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("session_end");
      expect(event?.data.result).toBe("Done.");
      expect(event?.data.isError).toBe(false);
      expect(event?.data.totalCostUsd).toBe(0.001);
    });

    it("maps error result to error event", () => {
      const event = adapter.parseLine({
        type: "result",
        result: "Something went wrong",
        session_id: "abc-123",
        is_error: true,
        total_cost_usd: 0,
        usage: { input_tokens: 0, output_tokens: 0 },
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("error");
      expect(event?.data.message).toBe("Something went wrong");
    });

    it("maps assistant message to message_complete", () => {
      const event = adapter.parseLine({
        type: "assistant",
        message: {
          id: "msg_01",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Four." }],
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
        },
        session_id: "abc-123",
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("message_complete");
      expect(event?.data.content).toEqual([{ type: "text", text: "Four." }]);
      expect(event?.data.stopReason).toBe("end_turn");
    });

    it("maps thinking content_block_start to thinking_delta", () => {
      const event = adapter.parseLine({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
        session_id: "abc-123",
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("thinking_delta");
      expect(event?.data.text).toBe("");
    });

    it("maps thinking_delta to thinking_delta event", () => {
      const event = adapter.parseLine({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "Let me consider..." },
        },
        session_id: "abc-123",
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("thinking_delta");
      expect(event?.data.text).toBe("Let me consider...");
    });

    it("extracts tool_use blocks from assistant message as tool_use_start events", () => {
      const events = adapter.parseLines([
        {
          type: "assistant",
          message: {
            id: "msg_01",
            type: "message",
            role: "assistant",
            content: [{ type: "tool_use", id: "toolu_01", name: "Read", input: { file_path: "/tmp/foo.ts" } }],
            model: "claude-sonnet-4-6",
            stop_reason: "tool_use",
          },
          session_id: "abc-123",
        },
      ]);
      const toolEvents = events.filter((e) => e.type === "tool_use_start");
      expect(toolEvents.length).toBe(1);
      expect(toolEvents[0].data.toolName).toBe("Read");
      expect(toolEvents[0].data.toolInput).toEqual({ file_path: "/tmp/foo.ts" });
    });

    it("maps user tool_result to tool_result event", () => {
      const events = adapter.parseLines([
        {
          type: "user",
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "toolu_01", content: "file contents here" }],
          },
          session_id: "abc-123",
        },
      ]);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe("tool_result");
      expect(events[0].data.toolId).toBe("toolu_01");
      expect(events[0].data.content).toBe("file contents here");
    });

    it("emits directory_permission_denied when tool_result contains permission denial", () => {
      const events = adapter.parseLines([
        {
          type: "user",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_02",
                content:
                  "Claude requested permissions to read from /Users/daniel/dev/papershelf, but you haven't granted it yet.",
              },
            ],
          },
          session_id: "abc-123",
        },
      ]);
      expect(events.length).toBe(2);
      expect(events[0].type).toBe("tool_result");
      expect(events[1].type).toBe("directory_permission_denied");
      expect(events[1].data.path).toBe("/Users/daniel/dev/papershelf");
    });

    it("does not emit directory_permission_denied for normal tool results", () => {
      const events = adapter.parseLines([
        {
          type: "user",
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "toolu_01", content: "file contents here" }],
          },
          session_id: "abc-123",
        },
      ]);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe("tool_result");
    });

    it("maps tool_use_summary to tool_use_summary event", () => {
      const event = adapter.parseLine({
        type: "tool_use_summary",
        summary: "Read package.json for project configuration",
        preceding_tool_use_ids: ["toolu_01"],
        session_id: "abc-123",
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("tool_use_summary");
      expect(event?.data.summary).toBe("Read package.json for project configuration");
    });

    it("returns null for unrecognized message types", () => {
      const event = adapter.parseLine({ type: "unknown_type", session_id: "abc-123" });
      expect(event).toBeNull();
    });

    it("returns null for non-delta stream events we don't map", () => {
      const event = adapter.parseLine({
        type: "stream_event",
        event: { type: "message_stop" },
        session_id: "abc-123",
      });
      expect(event).toBeNull();
    });
  });

  describe("end-to-end fixture parsing", () => {
    it("parses simple text response fixture into expected events", () => {
      const lines = loadFixtureEvents("claude-stream-simple.ndjson");
      const events = adapter.parseLines(lines);

      const types = events.map((e) => e.type);
      expect(types).toContain("session_start");
      expect(types).toContain("text_delta");
      expect(types).toContain("message_complete");
      expect(types).toContain("session_end");
    });

    it("parses tool use fixture into expected events", () => {
      const lines = loadFixtureEvents("claude-stream-tool-use.ndjson");
      const events = adapter.parseLines(lines);

      const types = events.map((e) => e.type);
      expect(types).toContain("session_start");
      expect(types).toContain("text_delta");
      expect(types).toContain("tool_use_start");
      expect(types).toContain("tool_use_delta");
      expect(types).toContain("message_complete");
      expect(types).toContain("session_end");
    });
  });
});
