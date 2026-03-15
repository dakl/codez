import { EventEmitter } from "node:events";
import type { AgentType } from "../../shared/agent-types.js";
import { SidebandDetector } from "./sideband-detector.js";

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
  detector: SidebandDetector;
  disposables: Array<{ dispose: () => void }>;
}

export class PtyManager extends EventEmitter {
  private sessions = new Map<string, PtySession>();
  private spawnFn: SpawnFn;

  constructor(spawnFn: SpawnFn) {
    super();
    this.spawnFn = spawnFn;
  }

  create(
    sessionId: string,
    agentType: AgentType,
    worktreePath: string,
    cols: number,
    rows: number,
    agentSessionId?: string | null,
  ): void {
    // Idempotent — skip if PTY already exists (React strict mode double-mounts in dev)
    if (this.sessions.has(sessionId)) return;

    const binaryName = agentType;

    // Build args — Claude in interactive mode manages its own sessions
    // per working directory, so we pass --continue for resumed sessions
    // to pick up the most recent conversation in that directory.
    const args: string[] = [];
    if (agentSessionId && agentType === "claude") {
      args.push("--continue");
    }

    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        cleanEnv[key] = value;
      }
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

    const detector = new SidebandDetector(agentType, (status) => {
      this.emit("statusChanged", sessionId, status);
    });

    const disposables: Array<{ dispose: () => void }> = [];

    disposables.push(
      pty.onData((data: string) => {
        this.emit("data", sessionId, data);
        detector.feed(data);
      }),
    );

    disposables.push(
      pty.onExit(({ exitCode }: { exitCode: number }) => {
        this.emit("exit", sessionId, exitCode);
        this.cleanup(sessionId);
      }),
    );

    this.sessions.set(sessionId, { pty, detector, disposables });
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`No PTY session found for ${sessionId}`);
    session.pty.write(data);
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
      session.detector.dispose();
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
    session.detector.dispose();
    for (const disposable of session.disposables) {
      disposable.dispose();
    }
    this.sessions.delete(sessionId);
  }
}
