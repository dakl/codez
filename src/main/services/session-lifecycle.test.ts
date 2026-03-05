import { EventEmitter } from "node:events";
import type { AgentEvent } from "@shared/agent-types";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../db/connection";
import { listMessages } from "../db/messages";
import { createRepo } from "../db/repos";
import { getSession } from "../db/sessions";
import { SessionLifecycle } from "./session-lifecycle";

// Simulate a child process with controllable stdout, stderr, stdin and exit
function createMockProcess() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = { write: vi.fn(), end: vi.fn() };
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    pid: number;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.stdin = stdin;
  proc.pid = 12345;
  proc.kill = vi.fn();
  return proc;
}

let db: Database.Database;

beforeEach(() => {
  db = createDatabase(":memory:");
  createRepo(db, "/Users/dan/project", "project");
});

afterEach(() => {
  db.close();
});

describe("SessionLifecycle", () => {
  it("creates a session in the database", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Fix bug",
      prompt: "Fix the null pointer",
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe("running");

    const dbSession = getSession(db, session.id);
    expect(dbSession).not.toBeNull();
    expect(dbSession?.status).toBe("running");
  });

  it("spawns the adapter process with correct args", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Fix bug",
      prompt: "Fix the null pointer",
    });

    expect(spawnFn).toHaveBeenCalledOnce();
    const [binary, args, options] = spawnFn.mock.calls[0];
    expect(binary).toBe("claude");
    expect(args).toContain("-p");
    expect(args).toContain("Fix the null pointer");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(options.cwd).toBe("/tmp/wt");
  });

  it("emits parsed agent events from stdout", async () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const events: AgentEvent[] = [];
    lifecycle.on("agentEvent", (event: AgentEvent) => events.push(event));

    lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    // Feed a system init line
    mockProcess.stdout.emit(
      "data",
      '{"type":"system","subtype":"init","session_id":"agent-sess-1","tools":[],"mcp_servers":[]}\n',
    );

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("session_start");
    expect(events[0].data.agentSessionId).toBe("agent-sess-1");
  });

  it("updates agent session ID in DB after system init", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    mockProcess.stdout.emit(
      "data",
      '{"type":"system","subtype":"init","session_id":"agent-sess-1","tools":[],"mcp_servers":[]}\n',
    );

    const dbSession = getSession(db, session.id);
    expect(dbSession?.agentSessionId).toBe("agent-sess-1");
  });

  it("sets status to waiting_for_input on process exit code 0", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    mockProcess.emit("close", 0);

    const dbSession = getSession(db, session.id);
    expect(dbSession?.status).toBe("waiting_for_input");
  });

  it("sets status to error on process exit code non-zero", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    mockProcess.emit("close", 1);

    const dbSession = getSession(db, session.id);
    expect(dbSession?.status).toBe("error");
  });

  it("stores assistant text as a message in the database", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    // Feed an assistant complete message
    mockProcess.stdout.emit(
      "data",
      '{"type":"assistant","message":{"id":"msg_01","type":"message","role":"assistant","content":[{"type":"text","text":"Here is the answer."}],"model":"claude-sonnet-4-6","stop_reason":"end_turn"},"session_id":"abc"}\n',
    );

    const messages = listMessages(db, session.id);
    expect(messages.length).toBe(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toBe("Here is the answer.");
  });

  it("reconstructs adapter and resumes after app restart", () => {
    // Simulate first run: start session, init, exit
    const mockProcess1 = createMockProcess();
    const mockProcess2 = createMockProcess();
    const spawnFn = vi.fn().mockReturnValueOnce(mockProcess1).mockReturnValueOnce(mockProcess2);

    const lifecycle1 = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle1.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    mockProcess1.stdout.emit(
      "data",
      '{"type":"system","subtype":"init","session_id":"agent-sess-1","tools":[],"mcp_servers":[]}\n',
    );
    mockProcess1.emit("close", 0);

    // Simulate app restart — new lifecycle instance, empty activeSessions
    const lifecycle2 = new SessionLifecycle({ db, spawnFn });

    // runPrompt should reconstruct the adapter and resume, not start fresh
    lifecycle2.runPrompt(session.id, "Continue after restart");

    const [binary, args] = spawnFn.mock.calls[1];
    expect(binary).toBe("claude");
    expect(args).toContain("--resume");
    expect(args).toContain("agent-sess-1");
    expect(args).not.toContain("--session-id");
  });

  it("stores thinking text from assistant message content blocks", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    // Feed an assistant message with thinking + text blocks
    const assistantMessage = JSON.stringify({
      type: "assistant",
      message: {
        id: "msg_01",
        type: "message",
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think about this carefully..." },
          { type: "text", text: "The answer is 42." },
        ],
        model: "claude-sonnet-4-6",
        stop_reason: "end_turn",
      },
      session_id: "abc",
    });
    mockProcess.stdout.emit("data", `${assistantMessage}\n`);

    const messages = listMessages(db, session.id);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("The answer is 42.");
    expect(messages[0].thinking).toBe("Let me think about this carefully...");
  });

  it("persists tool_use and tool_result messages from a multi-turn tool session", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Read package.json",
    });

    // 1) Assistant message with tool_use
    mockProcess.stdout.emit(
      "data",
      `${JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_01",
          type: "message",
          role: "assistant",
          content: [{ type: "tool_use", id: "toolu_01", name: "Read", input: { file_path: "package.json" } }],
          model: "claude-sonnet-4-6",
          stop_reason: "tool_use",
        },
        session_id: "abc",
      })}\n`,
    );

    // 2) User tool_result
    mockProcess.stdout.emit(
      "data",
      `${JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "toolu_01", content: '{"name":"codez"}' }],
        },
        session_id: "abc",
      })}\n`,
    );

    // 3) Final assistant text
    mockProcess.stdout.emit(
      "data",
      `${JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_02",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "The project is called codez." }],
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
        },
        session_id: "abc",
      })}\n`,
    );

    const messages = listMessages(db, session.id);
    expect(messages.length).toBe(3);

    // Tool use message
    expect(messages[0].role).toBe("tool_use");
    expect(messages[0].toolName).toBe("Read");
    expect(messages[0].content).toContain("package.json");

    // Tool result message
    expect(messages[1].role).toBe("tool_result");
    expect(messages[1].toolId).toBe("toolu_01");

    // Final assistant text
    expect(messages[2].role).toBe("assistant");
    expect(messages[2].content).toBe("The project is called codez.");
  });

  it("resumes a session with --resume flag", () => {
    const mockProcess1 = createMockProcess();
    const mockProcess2 = createMockProcess();
    const spawnFn = vi.fn().mockReturnValueOnce(mockProcess1).mockReturnValueOnce(mockProcess2);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    // Simulate init + exit
    mockProcess1.stdout.emit(
      "data",
      '{"type":"system","subtype":"init","session_id":"agent-sess-1","tools":[],"mcp_servers":[]}\n',
    );
    mockProcess1.emit("close", 0);

    // Resume
    lifecycle.resumeSession(session.id, "Continue please");

    const [binary, args] = spawnFn.mock.calls[1];
    expect(binary).toBe("claude");
    expect(args).toContain("--resume");
    expect(args).toContain("agent-sess-1");
    expect(args).toContain("Continue please");

    const dbSession = getSession(db, session.id);
    expect(dbSession?.status).toBe("running");
  });

  it("emits permission_request event when control_request arrives on stdout", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const events: AgentEvent[] = [];
    lifecycle.on("agentEvent", (event: AgentEvent) => events.push(event));

    lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    mockProcess.stdout.emit(
      "data",
      `${JSON.stringify({
        type: "control_request",
        request_id: "req_1_abc",
        request: { subtype: "can_use_tool", tool_name: "Bash", input: { command: "ls" } },
      })}\n`,
    );

    const permEvents = events.filter((e) => e.type === "permission_request");
    expect(permEvents.length).toBe(1);
    expect(permEvents[0].data.requestId).toBe("req_1_abc");
    expect(permEvents[0].data.toolName).toBe("Bash");
  });

  it("writes allow control_response to stdin when respondPermission called with approved=true", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    lifecycle.respondPermission(session.id, "req_1_abc", true, { command: "ls" });

    expect(mockProcess.stdin.write).toHaveBeenCalledOnce();
    const written = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
    expect(written.type).toBe("control_response");
    expect(written.request_id).toBe("req_1_abc");
    expect(written.response.subtype).toBe("success");
    expect(written.response.response.behavior).toBe("allow");
    expect(written.response.response.updatedInput).toEqual({ command: "ls" });
  });

  it("writes deny control_response to stdin when respondPermission called with approved=false", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    lifecycle.respondPermission(session.id, "req_2", false);

    expect(mockProcess.stdin.write).toHaveBeenCalledOnce();
    const written = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
    expect(written.type).toBe("control_response");
    expect(written.request_id).toBe("req_2");
    expect(written.response.response.behavior).toBe("deny");
  });

  it("throws when respondPermission called for session with no running process", () => {
    const mockProcess = createMockProcess();
    const spawnFn = vi.fn().mockReturnValue(mockProcess);

    const lifecycle = new SessionLifecycle({ db, spawnFn });
    const session = lifecycle.startSession({
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "Test",
      prompt: "Hello",
    });

    // Simulate process exit
    mockProcess.emit("close", 0);

    expect(() => lifecycle.respondPermission(session.id, "req_1", true)).toThrow();
  });

  describe("Mistral session handling", () => {
    it("returns error session when MISTRAL_API_KEY is not set for Mistral agent", () => {
      // Mock process.env to simulate missing API key
      const originalEnv = process.env;
      delete process.env.MISTRAL_API_KEY;

      try {
        const mockProcess = createMockProcess();
        const spawnFn = vi.fn().mockReturnValue(mockProcess);
        const mockEmit = vi.fn();

        const lifecycle = new SessionLifecycle({
          db,
          spawnFn,
          getMistralApiKey: () => null, // Mock settings to return no API key
        });
        lifecycle.emit = mockEmit;

        const session = lifecycle.startSession({
          repoPath: "/Users/dan/project",
          worktreePath: "/tmp/wt",
          agentType: "mistral",
          name: "Test Mistral Session",
          prompt: "Test prompt",
        });

        // Check that an error event was emitted
        expect(mockEmit).toHaveBeenCalledWith(
          "agentEvent",
          expect.objectContaining({
            type: "error",
            sessionId: session.id,
            data: expect.objectContaining({
              message: expect.stringContaining("API key"),
            }),
          }),
        );

        expect(mockEmit).toHaveBeenCalledWith("statusChanged", session.id, "error");

        // Verify spawnFn was NOT called (should return early)
        expect(spawnFn).not.toHaveBeenCalled();

        // Check the session status in the database
        const updatedSession = getSession(db, session.id);
        expect(updatedSession?.status).toBe("error");
      } finally {
        // Restore original environment
        process.env = originalEnv;
      }
    });

    it("uses API key from settings when environment variable is not set", () => {
      // Mock process.env to simulate missing API key
      const originalEnv = process.env;
      delete process.env.MISTRAL_API_KEY;

      try {
        const mockProcess = createMockProcess();
        const spawnFn = vi.fn().mockReturnValue(mockProcess);

        const lifecycle = new SessionLifecycle({
          db,
          spawnFn,
          getMistralApiKey: () => "test-api-key-from-settings", // Mock settings to return API key
        });

        const session = lifecycle.startSession({
          repoPath: "/Users/dan/project",
          worktreePath: "/tmp/wt",
          agentType: "mistral",
          name: "Test Mistral Session",
          prompt: "Test prompt",
        });

        // Should proceed normally since we have API key from settings
        expect(session.status).toBe("running");
        expect(spawnFn).toHaveBeenCalled();

        // Verify that the API key was set in process.env
        expect(process.env.MISTRAL_API_KEY).toBe("test-api-key-from-settings");
      } finally {
        // Restore original environment and clean up
        process.env = originalEnv;
        delete process.env.MISTRAL_API_KEY;
      }
    });
  });
});
