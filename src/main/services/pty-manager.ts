import { EventEmitter } from "node:events";
import type { AgentType } from "../../shared/agent-types.js";
import { getShellEnv, parseEnvOutput } from "../shell-env.js";
import type { StopWatcherFactory } from "./session-stop-watcher.js";
import { SidebandDetector } from "./sideband-detector.js";

type ShellEnvProvider = () => Record<string, string>;

interface PtyLike {
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (exitInfo: { exitCode: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  pid: number;
}

type SpawnFn = (
  file: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; cols: number; rows: number; name: string },
) => PtyLike;

interface PtySession {
  pty: PtyLike;
  // Unified interface — either a SessionStopWatcher (claude) or SidebandDetector (other agents)
  statusTracker: { dispose(): void };
  // Only set when using SidebandDetector — feeds PTY data into the timing heuristic
  detector: SidebandDetector | null;
  disposables: Array<{ dispose: () => void }>;
  // Tracks status locally so write() can avoid emitting redundant "running" events
  currentStatus: "running" | "waiting_for_input";
}

export class PtyManager extends EventEmitter {
  private sessions = new Map<string, PtySession>();
  private spawnFn: SpawnFn;
  private shellEnvProvider: ShellEnvProvider;
  private createStopWatcher: StopWatcherFactory | null;

  constructor(
    spawnFn: SpawnFn,
    shellEnvProvider: ShellEnvProvider = getShellEnv,
    createStopWatcher: StopWatcherFactory | null = null,
  ) {
    super();
    this.spawnFn = spawnFn;
    this.shellEnvProvider = shellEnvProvider;
    this.createStopWatcher = createStopWatcher;
  }

  create(
    sessionId: string,
    agentType: AgentType,
    worktreePath: string,
    cols: number,
    rows: number,
    agentSessionId?: string | null,
    binaryNameOverride?: string | null,
    extraArgsStr?: string | null,
    envVarsStr?: string | null,
  ): void {
    // Idempotent — skip if PTY already exists (React strict mode double-mounts in dev)
    if (this.sessions.has(sessionId)) return;

    const binaryName = binaryNameOverride ?? agentType;

    const args: string[] = [];
    if (agentType === "claude") {
      if (agentSessionId) {
        args.push("--resume", agentSessionId);
      } else {
        args.push("--session-id", sessionId);
      }
    }
    if (extraArgsStr) {
      const parsedExtra = extraArgsStr.trim().split(/\s+/).filter(Boolean);
      args.push(...parsedExtra);
    }

    // Build status tracker: use the stop hook watcher for claude sessions when
    // a factory is available, fall back to the sideband detector otherwise.
    let statusTracker: { dispose(): void };
    let detector: SidebandDetector | null = null;

    if (agentType === "claude" && this.createStopWatcher) {
      const watcher = this.createStopWatcher(sessionId, () => {
        const session = this.sessions.get(sessionId);
        if (session) session.currentStatus = "waiting_for_input";
        this.emit("statusChanged", sessionId, "waiting_for_input");
      });
      args.push("--settings", watcher.settingsFilePath);
      statusTracker = watcher;
    } else {
      detector = new SidebandDetector(agentType, (status) => {
        this.emit("statusChanged", sessionId, status);
      });
      statusTracker = detector;
    }

    const cleanEnv: Record<string, string> = { ...this.shellEnvProvider() };
    if (envVarsStr) {
      Object.assign(cleanEnv, parseEnvOutput(envVarsStr));
    }
    delete cleanEnv.CLAUDECODE;
    cleanEnv.TERM = "xterm-256color";

    const pty = this.spawnFn(binaryName, args, {
      cwd: worktreePath,
      env: cleanEnv,
      cols,
      rows,
      name: "xterm-256color",
    });

    const disposables: Array<{ dispose: () => void }> = [];

    disposables.push(
      pty.onData((data: string) => {
        this.emit("data", sessionId, data);
        detector?.feed(data);
      }),
    );

    disposables.push(
      pty.onExit(({ exitCode }: { exitCode: number }) => {
        this.emit("exit", sessionId, exitCode);
        this.cleanup(sessionId);
      }),
    );

    this.sessions.set(sessionId, {
      pty,
      statusTracker,
      detector,
      disposables,
      currentStatus: "running",
    });
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`No PTY session found for ${sessionId}`);
    session.pty.write(data);

    // When using the stop hook (no detector), flip to "running" on Enter.
    // This gives immediate feedback when the user submits a prompt.
    if (session.detector === null && session.currentStatus === "waiting_for_input" && data.includes("\r")) {
      session.currentStatus = "running";
      this.emit("statusChanged", sessionId, "running");
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.pty.resize(cols, rows);
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.pty.kill();
    this.cleanup(sessionId);
  }

  killAll(): void {
    for (const [, session] of this.sessions) {
      session.statusTracker.dispose();
      session.pty.kill();
      for (const disposable of session.disposables) {
        disposable.dispose();
      }
    }
    this.sessions.clear();
  }

  private cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.statusTracker.dispose();
    for (const disposable of session.disposables) {
      disposable.dispose();
    }
    this.sessions.delete(sessionId);
  }
}
