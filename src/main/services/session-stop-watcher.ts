import fs from "node:fs";
import path from "node:path";

interface FsOps {
  mkdirSync(dirPath: string, options?: { recursive?: boolean }): void;
  writeFileSync(filePath: string, data: string): void;
  rmSync(filePath: string, options?: { force?: boolean }): void;
  watch(filePath: string, listener: () => void): { close(): void };
}

// Wraps a path in single quotes, escaping any embedded single quotes.
// Handles spaces and most special shell characters.
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export type StopWatcherFactory = (
  sessionId: string,
  onIdle: () => void,
) => { settingsFilePath: string; dispose(): void };

/**
 * Manages per-session Claude Code stop hook plumbing.
 *
 * Writes a settings JSON file that injects a Stop hook into the Claude Code
 * session. The hook touches a signal file when Claude finishes a turn.
 * A file watcher detects this and calls onIdle — giving us a reliable,
 * semantic "Claude is done" signal with no timing heuristics.
 */
export class SessionStopWatcher {
  readonly settingsFilePath: string;
  private readonly signalFilePath: string;
  private readonly fsOps: FsOps;
  private watcher: { close(): void } | null = null;

  constructor(settingsFilePath: string, signalFilePath: string, onIdle: () => void, fsOps: FsOps = fs) {
    this.settingsFilePath = settingsFilePath;
    this.signalFilePath = signalFilePath;
    this.fsOps = fsOps;

    fsOps.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
    fsOps.mkdirSync(path.dirname(signalFilePath), { recursive: true });

    const hookSettings = {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: `touch ${shellQuote(signalFilePath)}`,
                async: true,
              },
            ],
          },
        ],
      },
    };
    fsOps.writeFileSync(settingsFilePath, JSON.stringify(hookSettings, null, 2));

    // Pre-create the signal file so fs.watch can attach before the hook fires.
    fsOps.writeFileSync(signalFilePath, "");

    this.watcher = fsOps.watch(signalFilePath, () => {
      onIdle();
    });
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    try {
      this.fsOps.rmSync(this.settingsFilePath, { force: true });
    } catch {
      // ignore — file may already be gone
    }
    try {
      this.fsOps.rmSync(this.signalFilePath, { force: true });
    } catch {
      // ignore
    }
  }
}
