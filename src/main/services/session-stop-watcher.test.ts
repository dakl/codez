import { describe, expect, it, vi } from "vitest";
import { SessionStopWatcher } from "./session-stop-watcher";

function createMockFsOps() {
  let watchListener: (() => void) | null = null;
  const watcher = { close: vi.fn() };

  const fsOps = {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    rmSync: vi.fn(),
    watch: vi.fn((_filePath: string, listener: () => void) => {
      watchListener = listener;
      return watcher;
    }),
  };

  return {
    fsOps,
    watcher,
    triggerSignal: () => watchListener?.(),
  };
}

describe("SessionStopWatcher", () => {
  it("writes settings JSON with the hook command on construction", () => {
    const { fsOps } = createMockFsOps();
    new SessionStopWatcher("/data/hook-settings/s1.json", "/data/hook-signals/s1", vi.fn(), fsOps);

    const settingsCall = (fsOps.writeFileSync.mock.calls as Array<[string, string]>).find(
      (call) => call[0] === "/data/hook-settings/s1.json",
    );
    expect(settingsCall).toBeDefined();

    const written = JSON.parse(settingsCall![1]);
    expect(written.hooks.Stop[0].hooks[0].command).toBe("touch '/data/hook-signals/s1'");
    expect(written.hooks.Stop[0].hooks[0].async).toBe(true);
  });

  it("pre-creates the signal file so the watcher can attach", () => {
    const { fsOps } = createMockFsOps();
    new SessionStopWatcher("/data/hook-settings/s1.json", "/data/hook-signals/s1", vi.fn(), fsOps);

    const signalCall = (fsOps.writeFileSync.mock.calls as Array<[string, string]>).find(
      (call) => call[0] === "/data/hook-signals/s1",
    );
    expect(signalCall).toBeDefined();
    expect(signalCall![1]).toBe("");
  });

  it("calls onIdle when the signal file is touched", () => {
    const { fsOps, triggerSignal } = createMockFsOps();
    const onIdle = vi.fn();
    new SessionStopWatcher("/data/hook-settings/s1.json", "/data/hook-signals/s1", onIdle, fsOps);

    triggerSignal();
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("calls onIdle every time the signal file changes (one hook fire per turn)", () => {
    const { fsOps, triggerSignal } = createMockFsOps();
    const onIdle = vi.fn();
    new SessionStopWatcher("/data/hook-settings/s1.json", "/data/hook-signals/s1", onIdle, fsOps);

    triggerSignal();
    triggerSignal();
    expect(onIdle).toHaveBeenCalledTimes(2);
  });

  it("exposes settingsFilePath for passing as --settings to Claude", () => {
    const { fsOps } = createMockFsOps();
    const watcher = new SessionStopWatcher("/data/hook-settings/s1.json", "/data/hook-signals/s1", vi.fn(), fsOps);
    expect(watcher.settingsFilePath).toBe("/data/hook-settings/s1.json");
  });

  it("dispose closes the watcher and removes both files", () => {
    const { fsOps, watcher } = createMockFsOps();
    const stopWatcher = new SessionStopWatcher(
      "/data/hook-settings/s1.json",
      "/data/hook-signals/s1",
      vi.fn(),
      fsOps,
    );

    stopWatcher.dispose();

    expect(watcher.close).toHaveBeenCalled();
    expect(fsOps.rmSync).toHaveBeenCalledWith("/data/hook-settings/s1.json", { force: true });
    expect(fsOps.rmSync).toHaveBeenCalledWith("/data/hook-signals/s1", { force: true });
  });

  it("dispose is safe to call twice", () => {
    const { fsOps } = createMockFsOps();
    const stopWatcher = new SessionStopWatcher(
      "/data/hook-settings/s1.json",
      "/data/hook-signals/s1",
      vi.fn(),
      fsOps,
    );

    stopWatcher.dispose();
    expect(() => stopWatcher.dispose()).not.toThrow();
  });
});
