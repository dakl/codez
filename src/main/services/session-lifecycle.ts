import { EventEmitter } from "node:events";
import type Database from "better-sqlite3";
import type { ChildProcess } from "node:child_process";
import { createSession, getSession, updateSessionStatus, updateAgentSessionId } from "../db/sessions.js";
import { createMessage } from "../db/messages.js";
import { createAdapter } from "../agents/agent-registry.js";
import { StreamParser } from "../agents/stream-parser.js";
import type { ClaudeAdapter } from "../agents/claude-adapter.js";
import type { AgentEvent, AgentType, SessionInfo } from "../../shared/agent-types.js";

type SpawnFn = (binary: string, args: string[], options: { cwd: string }) => ChildProcess;

interface SessionLifecycleOptions {
  db: Database.Database;
  spawnFn: SpawnFn;
  getAllowedTools?: () => string[];
  getPermissionMode?: () => string;
}

interface StartSessionParams {
  repoPath: string;
  worktreePath: string;
  agentType: AgentType;
  name: string;
  prompt: string;
}

// Tracks a running session's adapter and process
interface ActiveSession {
  adapter: ClaudeAdapter;
  parser: StreamParser;
  process: ChildProcess | null;
  worktreePath: string;
}

export class SessionLifecycle extends EventEmitter {
  private db: Database.Database;
  private spawnFn: SpawnFn;
  private getAllowedTools: () => string[];
  private getPermissionMode: () => string;
  private activeSessions = new Map<string, ActiveSession>();

  constructor(options: SessionLifecycleOptions) {
    super();
    this.db = options.db;
    this.spawnFn = options.spawnFn;
    this.getAllowedTools = options.getAllowedTools ?? (() => []);
    this.getPermissionMode = options.getPermissionMode ?? (() => "default");
  }

  startSession(params: StartSessionParams): SessionInfo {
    const session = createSession(this.db, {
      repoPath: params.repoPath,
      worktreePath: params.worktreePath,
      agentType: params.agentType,
      name: params.name,
    });

    updateSessionStatus(this.db, session.id, "running");

    const adapter = createAdapter({
      agentType: params.agentType,
      sessionId: session.id,
      worktreePath: params.worktreePath,
      allowedTools: this.getAllowedTools(),
      permissionMode: this.getPermissionMode(),
    });

    const parser = new StreamParser();
    const args = adapter.buildStartArgs(params.prompt);
    const proc = this.spawnFn("claude", args, { cwd: params.worktreePath });

    const activeSession: ActiveSession = {
      adapter,
      parser,
      process: proc,
      worktreePath: params.worktreePath,
    };
    this.activeSessions.set(session.id, activeSession);

    this.attachProcessListeners(session.id, proc);

    return { ...session, status: "running" };
  }

  /**
   * Send a prompt to an existing session. Handles both first-run (no agent
   * session ID yet) and resume (has agent session ID from previous turn).
   */
  runPrompt(sessionId: string, prompt: string): void {
    const session = getSession(this.db, sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (session.agentSessionId) {
      // Session has been used before — ensure adapter exists and resume
      this.ensureActiveSession(session);
      this.resumeSession(sessionId, prompt);
    } else {
      // First run — create adapter and spawn
      this.spawnNewProcess(session, prompt);
    }
  }

  /**
   * Reconstruct an ActiveSession entry if it's missing (e.g. after app restart)
   * but the DB still has the session's agent session ID.
   */
  private ensureActiveSession(session: SessionInfo): void {
    if (this.activeSessions.has(session.id)) return;

    const adapter = createAdapter({
      agentType: session.agentType,
      sessionId: session.id,
      worktreePath: session.worktreePath,
      allowedTools: this.getAllowedTools(),
      permissionMode: this.getPermissionMode(),
    });
    adapter.setAgentSessionId(session.agentSessionId!);

    this.activeSessions.set(session.id, {
      adapter,
      parser: new StreamParser(),
      process: null,
      worktreePath: session.worktreePath,
    });
  }

  resumeSession(sessionId: string, prompt: string): void {
    const session = getSession(this.db, sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const active = this.activeSessions.get(sessionId);
    if (!active) throw new Error(`No active adapter for session: ${sessionId}`);

    updateSessionStatus(this.db, sessionId, "running");
    this.emit("statusChanged", sessionId, "running");

    const args = active.adapter.buildResumeArgs(prompt);
    const proc = this.spawnFn("claude", args, { cwd: active.worktreePath });

    active.process = proc;
    active.parser.reset();

    this.attachProcessListeners(sessionId, proc);
  }

  respondPermission(
    sessionId: string,
    requestId: string,
    approved: boolean,
    updatedInput?: Record<string, unknown>,
  ): void {
    const active = this.activeSessions.get(sessionId);
    if (!active?.process?.stdin) {
      throw new Error(`No running process for session: ${sessionId}`);
    }

    const controlResponse = approved
      ? {
          type: "control_response",
          request_id: requestId,
          response: {
            subtype: "success",
            response: { behavior: "allow", updatedInput: updatedInput ?? {} },
          },
        }
      : {
          type: "control_response",
          request_id: requestId,
          response: {
            subtype: "success",
            response: { behavior: "deny", message: "User denied" },
          },
        };

    active.process.stdin.write(JSON.stringify(controlResponse) + "\n");
  }

  stopSession(sessionId: string): void {
    const active = this.activeSessions.get(sessionId);
    if (!active?.process) return;

    active.process.kill("SIGTERM");
    active.process = null;

    updateSessionStatus(this.db, sessionId, "waiting_for_input");
    this.emit("statusChanged", sessionId, "waiting_for_input");
  }

  private spawnNewProcess(session: SessionInfo, prompt: string): void {
    updateSessionStatus(this.db, session.id, "running");
    this.emit("statusChanged", session.id, "running");

    const adapter = createAdapter({
      agentType: session.agentType,
      sessionId: session.id,
      worktreePath: session.worktreePath,
      allowedTools: this.getAllowedTools(),
      permissionMode: this.getPermissionMode(),
    });

    const parser = new StreamParser();
    const args = adapter.buildStartArgs(prompt);
    const proc = this.spawnFn("claude", args, { cwd: session.worktreePath });

    const activeSession: ActiveSession = {
      adapter,
      parser,
      process: proc,
      worktreePath: session.worktreePath,
    };
    this.activeSessions.set(session.id, activeSession);

    this.attachProcessListeners(session.id, proc);
  }

  private attachProcessListeners(sessionId: string, proc: ChildProcess): void {
    const active = this.activeSessions.get(sessionId);
    if (!active) return;

    proc.stdout?.on("data", (chunk: Buffer | string) => {
      const data = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
      const lines = active.parser.feed(data);
      const events = active.adapter.parseLines(lines);

      for (const event of events) {
        this.handleEvent(sessionId, event);
        this.emit("agentEvent", event);
      }
    });

    let stderrBuffer = "";
    proc.stderr?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
      stderrBuffer += text;
      console.error(`[session ${sessionId}] stderr:`, text.trim());
    });

    proc.on("close", (code: number | null, signal: string | null) => {
      // If process was null, stopSession() already handled the status update
      if (!active.process) return;
      active.process = null;

      if (code === 0) {
        updateSessionStatus(this.db, sessionId, "waiting_for_input");
        this.emit("statusChanged", sessionId, "waiting_for_input");
      } else if (signal === "SIGTERM") {
        updateSessionStatus(this.db, sessionId, "waiting_for_input");
        this.emit("statusChanged", sessionId, "waiting_for_input");
      } else {
        const errorMessage = stderrBuffer.trim() || `Process exited with code ${code}`;
        console.error(`[session ${sessionId}] claude exited ${code}: ${errorMessage}`);
        updateSessionStatus(this.db, sessionId, "error");
        this.emit("statusChanged", sessionId, "error");
        this.emit("agentEvent", {
          type: "error",
          sessionId,
          timestamp: Date.now(),
          data: { message: errorMessage },
        });
      }
    });

    proc.on("error", (err: Error) => {
      console.error(`[session ${sessionId}] spawn error:`, err.message);
      updateSessionStatus(this.db, sessionId, "error");
      this.emit("statusChanged", sessionId, "error");
      this.emit("agentEvent", {
        type: "error",
        sessionId,
        timestamp: Date.now(),
        data: { message: `Failed to start claude: ${err.message}` },
      });
    });
  }

  private handleEvent(sessionId: string, event: AgentEvent): void {
    const active = this.activeSessions.get(sessionId);
    if (!active) return;

    if (event.type === "session_start") {
      const agentSessionId = event.data.agentSessionId as string;
      updateAgentSessionId(this.db, sessionId, agentSessionId);
    }

    if (event.type === "tool_use_start" && event.data.toolInput !== undefined) {
      const toolInput = event.data.toolInput as Record<string, unknown>;
      createMessage(this.db, {
        sessionId,
        role: "tool_use",
        content: JSON.stringify(toolInput),
        toolName: event.data.toolName as string,
        toolId: event.data.toolId as string,
      });
    }

    if (event.type === "tool_result") {
      const content = event.data.content;
      const contentStr = typeof content === "string" ? content : JSON.stringify(content);
      createMessage(this.db, {
        sessionId,
        role: "tool_result",
        content: contentStr,
        toolId: event.data.toolId as string,
      });
    }

    if (event.type === "message_complete") {
      const content = event.data.content as Array<{ type: string; text?: string; thinking?: string }>;
      const textParts = content.filter((block) => block.type === "text").map((block) => block.text ?? "");
      const fullText = textParts.join("");

      const thinkingParts = content.filter((block) => block.type === "thinking").map((block) => block.thinking ?? "");
      const thinkingText = thinkingParts.join("") || undefined;

      if (fullText) {
        createMessage(this.db, {
          sessionId,
          role: "assistant",
          content: fullText,
          thinking: thinkingText,
        });
      }
    }
  }
}
