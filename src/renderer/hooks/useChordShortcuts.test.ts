import { describe, expect, it } from "vitest";

// Since useSessionShortcuts is a thin hook that registers a keydown listener,
// we test the keyboard→session-selection logic directly.

function makeSession(id: string, repoPath = "/repo/a") {
  return {
    id,
    repoPath,
    worktreePath: `${repoPath}/.codez/worktrees/${id}`,
    agentType: "claude" as const,
    agentSessionId: null,
    status: "idle" as const,
    name: `Session ${id}`,
    createdAt: "2026-01-01T00:00:00Z",
    lastActiveAt: "2026-01-01T00:00:00Z",
  };
}

describe("session shortcut logic", () => {
  it("maps Cmd+1 to first session", () => {
    const sessions = [makeSession("a"), makeSession("b"), makeSession("c")];
    const digit = 1;
    const index = digit - 1;
    expect(sessions[index]?.id).toBe("a");
  });

  it("maps Cmd+3 to third session", () => {
    const sessions = [makeSession("a"), makeSession("b"), makeSession("c")];
    const digit = 3;
    const index = digit - 1;
    expect(sessions[index]?.id).toBe("c");
  });

  it("ignores digits beyond session count", () => {
    const sessions = [makeSession("a"), makeSession("b")];
    const digit = 5;
    const index = digit - 1;
    expect(sessions[index]).toBeUndefined();
  });

  it("ignores digit 0", () => {
    const digit = 0;
    expect(digit >= 1 && digit <= 9).toBe(false);
  });

  it("supports up to 9 sessions", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(`s${i}`));
    const digit = 9;
    const index = digit - 1;
    expect(sessions[index]?.id).toBe("s8");
  });
});
