import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { PtyManager } from "./pty-manager";

function createMockPty() {
  const emitter = new EventEmitter();
  return {
    onData: (callback: (data: string) => void) => {
      emitter.on("data", callback);
      return { dispose: () => emitter.removeListener("data", callback) };
    },
    onExit: (callback: (exitInfo: { exitCode: number }) => void) => {
      emitter.on("exit", callback);
      return { dispose: () => emitter.removeListener("exit", callback) };
    },
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
    // Test helpers
    _emitData: (data: string) => emitter.emit("data", data),
    _emitExit: (exitCode: number) => emitter.emit("exit", { exitCode }),
  };
}

type MockPty = ReturnType<typeof createMockPty>;

describe("PtyManager", () => {
  function createManager() {
    let lastMockPty: MockPty | null = null;
    const spawnFn = vi.fn((_file: string, _args: string[], _options: unknown) => {
      lastMockPty = createMockPty();
      return lastMockPty;
    });
    const manager = new PtyManager(spawnFn, () => ({}));
    return { manager, spawnFn, getLastPty: () => lastMockPty as MockPty };
  }

  describe("create", () => {
    it("spawns a PTY with --session-id for new claude session", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "claude", "/repo/path", 80, 24);

      expect(spawnFn).toHaveBeenCalledWith(
        "claude",
        ["--session-id", "session-1"],
        expect.objectContaining({
          cwd: "/repo/path",
          cols: 80,
          rows: 24,
        }),
      );
    });

    it("sets TERM to xterm-256color", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24);

      const callOptions = spawnFn.mock.calls[0][2] as { env: Record<string, string> };
      expect(callOptions.env.TERM).toBe("xterm-256color");
    });

    it("merges shell env vars into the PTY environment", () => {
      const spawnFn = vi.fn((_f: string, _a: string[], _o: unknown) => createMockPty());
      const shellEnvProvider = () => ({ MY_TOKEN: "secret123", MY_PATH: "/custom/bin:/usr/bin" });
      const manager = new PtyManager(spawnFn, shellEnvProvider);
      manager.create("session-1", "claude", "/repo", 80, 24);

      const callOptions = spawnFn.mock.calls[0][2] as { env: Record<string, string> };
      expect(callOptions.env.MY_TOKEN).toBe("secret123");
      expect(callOptions.env.MY_PATH).toBe("/custom/bin:/usr/bin");
    });

    it("does not pass CLAUDECODE to the PTY environment", () => {
      const spawnFn = vi.fn((_f: string, _a: string[], _o: unknown) => createMockPty());
      const manager = new PtyManager(spawnFn, () => ({ CLAUDECODE: "1" }));
      manager.create("session-1", "claude", "/repo", 80, 24);

      const callOptions = spawnFn.mock.calls[0][2] as { env: Record<string, string> };
      expect(callOptions.env.CLAUDECODE).toBeUndefined();
    });

    it("passes --session-id for first launch of a claude session", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24);

      expect(spawnFn).toHaveBeenCalledWith(
        "claude",
        ["--session-id", "session-1"],
        expect.objectContaining({ cwd: "/repo" }),
      );
    });

    it("passes --resume for subsequent launches of a claude session", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24, "session-1");

      expect(spawnFn).toHaveBeenCalledWith(
        "claude",
        ["--resume", "session-1"],
        expect.objectContaining({ cwd: "/repo" }),
      );
    });

    it("passes no session args for non-claude agents", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "gemini", "/repo", 80, 24);

      expect(spawnFn).toHaveBeenCalledWith("gemini", [], expect.objectContaining({ cwd: "/repo" }));
    });

    it("uses binaryNameOverride instead of agentType when provided", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24, null, "claude-work");

      expect(spawnFn).toHaveBeenCalledWith("claude-work", expect.any(Array), expect.objectContaining({ cwd: "/repo" }));
    });

    it("appends parsed extraArgsStr to the args", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24, null, null, "--model claude-opus-4-5 --max-turns 10");

      const calledArgs = spawnFn.mock.calls[0][1] as string[];
      expect(calledArgs).toContain("--model");
      expect(calledArgs).toContain("claude-opus-4-5");
      expect(calledArgs).toContain("--max-turns");
      expect(calledArgs).toContain("10");
    });

    it("ignores empty extraArgsStr", () => {
      const { manager, spawnFn } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24, null, null, "  ");

      const calledArgs = spawnFn.mock.calls[0][1] as string[];
      // Should only have --session-id args, no extra flags
      expect(calledArgs).toEqual(["--session-id", "session-1"]);
    });
  });

  describe("write", () => {
    it("writes data to the PTY", () => {
      const { manager, getLastPty } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24);
      manager.write("session-1", "hello");

      expect(getLastPty().write).toHaveBeenCalledWith("hello");
    });

    it("throws for unknown session", () => {
      const { manager } = createManager();
      expect(() => manager.write("nonexistent", "hello")).toThrow();
    });
  });

  describe("resize", () => {
    it("resizes the PTY", () => {
      const { manager, getLastPty } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24);
      manager.resize("session-1", 120, 40);

      expect(getLastPty().resize).toHaveBeenCalledWith(120, 40);
    });
  });

  describe("kill", () => {
    it("kills the PTY and removes the session", () => {
      const { manager, getLastPty } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24);
      manager.kill("session-1");

      expect(getLastPty().kill).toHaveBeenCalled();
      expect(() => manager.write("session-1", "hello")).toThrow();
    });
  });

  describe("killAll", () => {
    it("kills all PTY sessions", () => {
      const { manager } = createManager();
      const ptys: MockPty[] = [];

      manager.create("s1", "claude", "/repo", 80, 24);
      ptys.push(createManager().getLastPty()); // won't work, need to track differently

      // Create two sessions and verify both are cleaned up
      const { manager: mgr, spawnFn } = createManager();
      mgr.create("s1", "claude", "/repo", 80, 24);
      const pty1 = spawnFn.mock.results[0].value as MockPty;
      mgr.create("s2", "claude", "/repo", 80, 24);
      const pty2 = spawnFn.mock.results[1].value as MockPty;

      mgr.killAll();
      expect(pty1.kill).toHaveBeenCalled();
      expect(pty2.kill).toHaveBeenCalled();
    });
  });

  describe("events", () => {
    it("emits data events from PTY output", () => {
      const { manager, getLastPty } = createManager();
      const received: string[] = [];
      manager.on("data", (sessionId: string, data: string) => {
        received.push(`${sessionId}:${data}`);
      });

      manager.create("session-1", "claude", "/repo", 80, 24);
      getLastPty()._emitData("hello world");

      expect(received).toEqual(["session-1:hello world"]);
    });

    it("emits exit events when PTY exits", () => {
      const { manager, getLastPty } = createManager();
      const exits: Array<{ sessionId: string; exitCode: number }> = [];
      manager.on("exit", (sessionId: string, exitCode: number) => {
        exits.push({ sessionId, exitCode });
      });

      manager.create("session-1", "claude", "/repo", 80, 24);
      getLastPty()._emitExit(0);

      expect(exits).toEqual([{ sessionId: "session-1", exitCode: 0 }]);
    });

    it("emits statusChanged from sideband detector after idle timeout (fallback for non-claude agents)", () => {
      vi.useFakeTimers();
      try {
        const { manager, getLastPty } = createManager();
        const statuses: Array<{ sessionId: string; status: string }> = [];
        manager.on("statusChanged", (sessionId: string, status: string) => {
          statuses.push({ sessionId, status });
        });

        manager.create("session-1", "gemini", "/repo", 80, 24);
        getLastPty()._emitData("some output");
        expect(statuses).toEqual([]);

        vi.advanceTimersByTime(10_000);
        expect(statuses).toEqual([{ sessionId: "session-1", status: "waiting_for_input" }]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("cleans up session on PTY exit", () => {
      const { manager, getLastPty } = createManager();
      manager.create("session-1", "claude", "/repo", 80, 24);
      getLastPty()._emitExit(0);

      // Session should be cleaned up after exit
      expect(() => manager.write("session-1", "hello")).toThrow();
    });
  });

  describe("stop hook watcher (claude sessions)", () => {
    function createMockStopWatcher() {
      let idleCallback: (() => void) | null = null;
      const watcherDispose = vi.fn();
      const factory = vi.fn((sessionId: string, onIdle: () => void) => {
        idleCallback = onIdle;
        return {
          settingsFilePath: `/mock-hook-settings/${sessionId}.json`,
          dispose: watcherDispose,
        };
      });
      return {
        factory,
        watcherDispose,
        triggerIdle: () => idleCallback?.(),
      };
    }

    function createManagerWithWatcher() {
      const { factory, watcherDispose, triggerIdle } = createMockStopWatcher();
      let lastMockPty: MockPty | null = null;
      const spawnFn = vi.fn((_file: string, _args: string[], _options: unknown) => {
        lastMockPty = createMockPty();
        return lastMockPty;
      });
      const manager = new PtyManager(spawnFn, () => ({}), factory);
      return { manager, spawnFn, factory, watcherDispose, triggerIdle, getLastPty: () => lastMockPty as MockPty };
    }

    it("appends --settings <path> to args for claude sessions when factory is provided", () => {
      const { manager, spawnFn } = createManagerWithWatcher();
      manager.create("session-1", "claude", "/repo", 80, 24);

      const calledArgs = spawnFn.mock.calls[0][1] as string[];
      const settingsIndex = calledArgs.indexOf("--settings");
      expect(settingsIndex).not.toBe(-1);
      expect(calledArgs[settingsIndex + 1]).toBe("/mock-hook-settings/session-1.json");
    });

    it("does not append --settings for non-claude agents even when factory is provided", () => {
      const { manager, spawnFn } = createManagerWithWatcher();
      manager.create("session-1", "gemini", "/repo", 80, 24);

      const calledArgs = spawnFn.mock.calls[0][1] as string[];
      expect(calledArgs).not.toContain("--settings");
    });

    it("emits waiting_for_input when the stop hook fires", () => {
      const { manager, triggerIdle } = createManagerWithWatcher();
      const statuses: Array<{ sessionId: string; status: string }> = [];
      manager.on("statusChanged", (sessionId: string, status: string) => {
        statuses.push({ sessionId, status });
      });

      manager.create("session-1", "claude", "/repo", 80, 24);
      triggerIdle();

      expect(statuses).toEqual([{ sessionId: "session-1", status: "waiting_for_input" }]);
    });

    it("emits running when the user presses Enter while waiting", () => {
      const { manager, triggerIdle } = createManagerWithWatcher();
      const statuses: Array<{ sessionId: string; status: string }> = [];
      manager.on("statusChanged", (sessionId: string, status: string) => {
        statuses.push({ sessionId, status });
      });

      manager.create("session-1", "claude", "/repo", 80, 24);
      triggerIdle(); // now waiting_for_input
      manager.write("session-1", "\r"); // user presses Enter

      expect(statuses).toEqual([
        { sessionId: "session-1", status: "waiting_for_input" },
        { sessionId: "session-1", status: "running" },
      ]);
    });

    it("does not emit running on Enter when already running", () => {
      const { manager } = createManagerWithWatcher();
      const statuses: Array<{ sessionId: string; status: string }> = [];
      manager.on("statusChanged", (sessionId: string, status: string) => {
        statuses.push({ sessionId, status });
      });

      manager.create("session-1", "claude", "/repo", 80, 24);
      // Still in initial "running" state — pressing Enter should not re-emit running
      manager.write("session-1", "\r");

      expect(statuses).toEqual([]);
    });

    it("disposes the watcher on session cleanup", () => {
      const { manager, getLastPty, watcherDispose } = createManagerWithWatcher();
      manager.create("session-1", "claude", "/repo", 80, 24);
      getLastPty()._emitExit(0);

      expect(watcherDispose).toHaveBeenCalled();
    });
  });
});
