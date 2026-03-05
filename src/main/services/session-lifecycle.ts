import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { AgentEvent, AgentType, SessionInfo } from "../../shared/agent-types.js";
import { createAdapter } from "../agents/agent-registry.js";
import type { ClaudeAdapter } from "../agents/claude-adapter.js";
import type { MistralAdapter } from "../agents/mistral-adapter.js";
import { StreamParser } from "../agents/stream-parser.js";
import { createMessage } from "../db/messages.js";
import { createSession, getSession, updateAgentSessionId, updateSessionStatus } from "../db/sessions.js";

type SpawnFn = (binary: string, args: string[], options: { cwd: string }) => ChildProcess;

interface SessionLifecycleOptions {
  db: Database.Database;
  spawnFn: SpawnFn;
  getAllowedTools?: () => string[];
  getAdditionalDirs?: () => string[];
  getPermissionMode?: () => string;
  getMistralApiKey?: () => string | null;
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
  adapter: ClaudeAdapter | MistralAdapter;
  parser: StreamParser;
  process: ChildProcess | null;
  worktreePath: string;
}

export class SessionLifecycle extends EventEmitter {
  private db: Database.Database;
  private spawnFn: SpawnFn;
  private getAllowedTools: () => string[];
  private getAdditionalDirs: () => string[];
  private getPermissionMode: () => string;
  private getMistralApiKey: () => string | null;
  private activeSessions = new Map<string, ActiveSession>();

  constructor(options: SessionLifecycleOptions) {
    super();
    this.db = options.db;
    this.spawnFn = options.spawnFn;
    this.getAllowedTools = options.getAllowedTools ?? (() => []);
    this.getAdditionalDirs = options.getAdditionalDirs ?? (() => []);
    this.getPermissionMode = options.getPermissionMode ?? (() => "default");
    this.getMistralApiKey = options.getMistralApiKey ?? (() => null);
  }

  startSession(params: StartSessionParams): SessionInfo {
    console.log(`[MistralDebug] Starting session with agentType: ${params.agentType}`);

    // Check for MISTRAL_API_KEY before creating session for Mistral agent
    if (params.agentType === "mistral") {
      const envApiKey = process.env.MISTRAL_API_KEY;
      const settingsApiKey = this.getMistralApiKey();
      const apiKey = envApiKey || settingsApiKey;

      console.log(`[MistralDebug] MISTRAL_API_KEY from env: ${envApiKey ? "SET" : "NOT SET"}`);
      console.log(`[MistralDebug] MISTRAL_API_KEY from settings: ${settingsApiKey ? "SET" : "NOT SET"}`);

      if (!apiKey) {
        const errorMessage =
          `Mistral Vibe requires an API key. ` +
          `You can set it in your shell environment (MISTRAL_API_KEY) ` +
          `or configure it in Codez settings.`;
        console.error(`[MistralDebug] ERROR: ${errorMessage}`);

        // Create session with error status immediately
        const session = createSession(this.db, {
          repoPath: params.repoPath,
          worktreePath: params.worktreePath,
          agentType: params.agentType,
          name: params.name,
        });

        updateSessionStatus(this.db, session.id, "error");

        // Emit a user-friendly error event
        this.emit("agentEvent", {
          type: "error",
          sessionId: session.id,
          timestamp: Date.now(),
          data: {
            message: errorMessage,
            suggestion: "Set MISTRAL_API_KEY environment variable or configure API key in settings.",
          },
        });

        this.emit("statusChanged", session.id, "error");
        return session; // Return early to prevent spawn attempt
      }

      // If we have an API key from settings but not from environment, add it to the environment
      if (settingsApiKey && !envApiKey) {
        console.log(`[MistralDebug] Using API key from settings`);
        process.env.MISTRAL_API_KEY = settingsApiKey;
      }
    }

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
      additionalDirs: this.getAdditionalDirs(),
      permissionMode: this.getPermissionMode(),
    });

    const parser = new StreamParser();
    const args = adapter.buildStartArgs(params.prompt);
    const binaryName = params.agentType === "mistral" ? "vibe" : "claude";

    console.log(`[MistralDebug] Spawning binary: ${binaryName}`);
    console.log(`[MistralDebug] Arguments: ${args.join(" ")}`);
    console.log(`[MistralDebug] Full command: ${binaryName} ${args.join(" ")}`);
    console.log(`[MistralDebug] Working directory: ${params.worktreePath}`);
    console.log(`[MistralDebug] Allowed tools: ${this.getAllowedTools().join(", ")}`);
    console.log(`[MistralDebug] Permission mode: ${this.getPermissionMode()}`);

    // Debug environment variables for Mistral
    if (params.agentType === "mistral") {
      console.log(`[MistralDebug] MISTRAL_API_KEY in process.env: ${process.env.MISTRAL_API_KEY ? "SET" : "NOT SET"}`);
      console.log(`[MistralDebug] Current working directory: ${process.cwd()}`);
      console.log(
        `[MistralDebug] Full environment keys:`,
        Object.keys(process.env).filter((k) => k.includes("API") || k.includes("KEY")),
      );

      try {
        const { execSync } = require("node:child_process");
        const whichResult = execSync("which vibe", { encoding: "utf8" });
        console.log(`[MistralDebug] vibe binary location: ${whichResult.trim()}`);
      } catch (error) {
        console.log(
          `[MistralDebug] WARNING: vibe binary not found in PATH: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Add process event listeners for debugging
    const proc = this.spawnFn(binaryName, args, { cwd: params.worktreePath });

    if (params.agentType === "mistral") {
      proc.on("spawn", () => {
        console.log(`[MistralDebug] Process spawned successfully with PID: ${proc.pid}`);
      });

      proc.on("error", (error) => {
        console.error(`[MistralDebug] Process error:`, error);
        console.error(`[MistralDebug] Error message:`, error.message);
        console.error(`[MistralDebug] Error stack:`, error.stack);
        // Note: error.code may not exist on all error types
        if ("code" in error) {
          console.error(`[MistralDebug] Error code:`, error.code);
        }
      });
    }

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
      additionalDirs: this.getAdditionalDirs(),
      permissionMode: this.getPermissionMode(),
    });
    adapter.setAgentSessionId(session.agentSessionId ?? "");

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
    const binaryName = session.agentType === "mistral" ? "vibe" : "claude";

    if (session.agentType === "mistral") {
      console.log(`[MistralDebug] Resuming session with binary: ${binaryName}`);
      console.log(`[MistralDebug] Resume arguments: ${args.join(" ")}`);
      console.log(`[MistralDebug] Resuming session ID: ${session.agentSessionId}`);
    }

    const proc = this.spawnFn(binaryName, args, { cwd: active.worktreePath });

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

    active.process.stdin.write(`${JSON.stringify(controlResponse)}\n`);
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
      additionalDirs: this.getAdditionalDirs(),
      permissionMode: this.getPermissionMode(),
    });

    const parser = new StreamParser();
    const args = adapter.buildStartArgs(prompt);
    const binaryName = session.agentType === "mistral" ? "vibe" : "claude";
    const proc = this.spawnFn(binaryName, args, { cwd: session.worktreePath });

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

      // Debug raw output for Mistral sessions
      const session = getSession(this.db, sessionId);
      if (session?.agentType === "mistral") {
        console.log(`[MistralDebug] Raw stdout chunk (${data.length} bytes):`);
        console.log(`[MistralDebug] ${data.trim()}`);

        // Check if this looks like JSON or plain text
        try {
          const parsed = JSON.parse(data.trim());
          console.log(`[MistralDebug] Parsed as JSON:`, parsed);
        } catch (_e) {
          console.log(`[MistralDebug] Not JSON format - plain text detected`);
        }
      }

      const lines = active.parser.feed(data);
      const events = active.adapter.parseLines(lines);

      for (const event of events) {
        this.handleEvent(sessionId, event);
        this.emit("agentEvent", event);
      }

      // Log stdout for mistral sessions to help debugging
      if (session?.agentType === "mistral") {
        console.log(`[MistralDebug] stdout chunk:`, data.trim());
      }
    });

    let stderrBuffer = "";
    proc.stderr?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
      stderrBuffer += text;
      console.error(`[session ${sessionId}] stderr:`, text.trim());
      // Check if this is a mistral session by looking at the session info
      const session = getSession(this.db, sessionId);
      if (session?.agentType === "mistral") {
        console.error(`[MistralDebug] stderr chunk:`, text.trim());
      }
    });

    proc.on("close", (code: number | null, signal: string | null) => {
      // If process was null, stopSession() already handled the status update
      if (!active.process) return;
      active.process = null;

      if (code === 0) {
        // For vibe sessions, capture the real session ID from the filesystem
        // Only scan on the first turn (when we have a fake or missing ID)
        const session = getSession(this.db, sessionId);
        const currentVibeId = active.adapter.getAgentSessionId();
        const needsRealId = session?.agentType === "mistral" && (!currentVibeId || currentVibeId.startsWith("vibe-"));
        if (needsRealId) {
          const vibeSessionId = this.findLatestVibeSessionId();
          if (vibeSessionId) {
            active.adapter.setAgentSessionId(vibeSessionId);
            updateAgentSessionId(this.db, sessionId, vibeSessionId);
          }
        }
        updateSessionStatus(this.db, sessionId, "waiting_for_input");
        this.emit("statusChanged", sessionId, "waiting_for_input");
      } else if (signal === "SIGTERM") {
        updateSessionStatus(this.db, sessionId, "waiting_for_input");
        this.emit("statusChanged", sessionId, "waiting_for_input");
      } else {
        const errorMessage = stderrBuffer.trim() || `Process exited with code ${code}`;
        // Get the session to determine which binary was running
        const session = getSession(this.db, sessionId);
        const binaryName = session?.agentType === "mistral" ? "vibe" : "claude";

        if (session?.agentType === "mistral") {
          console.error(`[MistralDebug] Full stderr output:`);
          console.error(stderrBuffer);
          console.error(`[MistralDebug] Exit code: ${code}`);
          console.error(`[MistralDebug] This suggests vibe rejected our arguments or encountered an error`);
        }

        console.error(`[session ${sessionId}] ${binaryName} exited ${code}: ${errorMessage}`);
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

  /**
   * Find the most recently created vibe session ID from ~/.vibe/logs/session/.
   * Returns the hash suffix (e.g. "92ed7308") which vibe accepts for --resume.
   */
  private findLatestVibeSessionId(): string | null {
    try {
      const sessionDir = join(homedir(), ".vibe", "logs", "session");
      const entries = readdirSync(sessionDir)
        .filter((name) => name.startsWith("session_"))
        .map((name) => ({
          name,
          mtime: statSync(join(sessionDir, name)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (entries.length === 0) return null;

      // Extract hash suffix: session_20260305_140511_92ed7308 → 92ed7308
      const match = entries[0].name.match(/_([a-f0-9]+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
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
      const rawContent = event.data.content;
      let fullText: string;
      let thinkingText: string | undefined;

      if (typeof rawContent === "string") {
        // Vibe format: content is a plain string
        fullText = rawContent;
        thinkingText = undefined;
      } else {
        // Claude format: content is an array of typed blocks
        const content = rawContent as Array<{ type: string; text?: string; thinking?: string }>;
        const textParts = content.filter((block) => block.type === "text").map((block) => block.text ?? "");
        fullText = textParts.join("");
        const thinkingParts = content.filter((block) => block.type === "thinking").map((block) => block.thinking ?? "");
        thinkingText = thinkingParts.join("") || undefined;
      }

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
