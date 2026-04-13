import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebandDetector } from "./sideband-detector";

describe("SidebandDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in running status", () => {
    const detector = new SidebandDetector("claude");
    expect(detector.status).toBe("running");
  });

  it("transitions to waiting_for_input after idle timeout", () => {
    const detector = new SidebandDetector("claude");
    detector.feed("some output");
    expect(detector.status).toBe("running");
    vi.advanceTimersByTime(10_000);
    expect(detector.status).toBe("waiting_for_input");
  });

  it("resets idle timer on new data", () => {
    const detector = new SidebandDetector("claude");
    detector.feed("chunk 1");
    vi.advanceTimersByTime(6_000);
    expect(detector.status).toBe("running");
    detector.feed("chunk 2");
    vi.advanceTimersByTime(6_000);
    expect(detector.status).toBe("running");
    vi.advanceTimersByTime(4_001);
    expect(detector.status).toBe("waiting_for_input");
  });

  it("goes back to running when new data arrives after idle", () => {
    const detector = new SidebandDetector("claude");
    detector.feed("initial");
    vi.advanceTimersByTime(10_000);
    expect(detector.status).toBe("waiting_for_input");
    detector.feed("new data");
    expect(detector.status).toBe("running");
  });

  it("calls onStatusChange on transitions", () => {
    const changes: string[] = [];
    const detector = new SidebandDetector("claude", (status) => {
      changes.push(status);
    });
    detector.feed("output");
    vi.advanceTimersByTime(10_000);
    detector.feed("more output");
    vi.advanceTimersByTime(10_000);
    expect(changes).toEqual(["waiting_for_input", "running", "waiting_for_input"]);
  });

  it("does not call onStatusChange when status stays the same", () => {
    const changes: string[] = [];
    const detector = new SidebandDetector("claude", (status) => {
      changes.push(status);
    });
    detector.feed("chunk 1");
    detector.feed("chunk 2");
    detector.feed("chunk 3");
    expect(changes).toEqual([]);
  });

  it("uses custom idle timeout", () => {
    const detector = new SidebandDetector("claude", undefined, 1000);
    detector.feed("data");
    vi.advanceTimersByTime(500);
    expect(detector.status).toBe("running");
    vi.advanceTimersByTime(500);
    expect(detector.status).toBe("waiting_for_input");
  });

  it("cleans up timer on dispose", () => {
    const changes: string[] = [];
    const detector = new SidebandDetector("claude", (status) => {
      changes.push(status);
    });
    detector.feed("data");
    detector.dispose();
    vi.advanceTimersByTime(500);
    expect(changes).toEqual([]);
    expect(detector.status).toBe("running");
  });
});
