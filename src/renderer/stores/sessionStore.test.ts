import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "./sessionStore";

// Minimal mock for window.electronAPI — only methods called by the store
const mockElectronAPI = {
  ptyKill: vi.fn().mockResolvedValue(undefined),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  archiveSession: vi.fn().mockResolvedValue(undefined),
  listSessions: vi.fn().mockResolvedValue([]),
  listArchivedSessions: vi.fn().mockResolvedValue([]),
};

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as unknown as { window: { electronAPI: typeof mockElectronAPI } }).window = {
    electronAPI: mockElectronAPI,
  };
});

afterEach(() => {
  vi.useRealTimers();
  useSessionStore.setState({
    sessions: [],
    archivedSessions: [],
    activeSessionId: null,
    unreadSessionIds: new Set(),
  });
});

function seedSessions() {
  useSessionStore.setState({
    sessions: [
      {
        id: "s1",
        repoPath: "/repo",
        worktreePath: "/repo",
        agentType: "claude",
        status: "running",
        name: "S1",
        branchName: null,
        agentSessionId: null,
        createdAt: "",
        sortOrder: 0,
      },
      {
        id: "s2",
        repoPath: "/repo",
        worktreePath: "/repo",
        agentType: "claude",
        status: "running",
        name: "S2",
        branchName: null,
        agentSessionId: null,
        createdAt: "",
        sortOrder: 1,
      },
    ],
    activeSessionId: "s1",
  });
}

describe("unread state", () => {
  it("marks non-active session unread on waiting_for_input", () => {
    seedSessions();
    useSessionStore.getState().handleStatusChange("s2", "waiting_for_input");
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(true);
  });

  it("does NOT mark the active session unread", () => {
    seedSessions();
    useSessionStore.getState().handleStatusChange("s1", "waiting_for_input");
    expect(useSessionStore.getState().unreadSessionIds.has("s1")).toBe(false);
  });

  it("clears unread when status changes to running", () => {
    seedSessions();
    useSessionStore.setState({ unreadSessionIds: new Set(["s2"]) });
    useSessionStore.getState().handleStatusChange("s2", "running");
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(false);
  });

  it("clears unread when status changes to archived", () => {
    seedSessions();
    useSessionStore.setState({ unreadSessionIds: new Set(["s2"]) });
    useSessionStore.getState().handleStatusChange("s2", "archived");
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(false);
  });

  it("markUnread adds to the set", () => {
    seedSessions();
    useSessionStore.getState().markUnread("s1");
    expect(useSessionStore.getState().unreadSessionIds.has("s1")).toBe(true);
  });

  it("markRead removes from the set", () => {
    seedSessions();
    useSessionStore.setState({ unreadSessionIds: new Set(["s1"]) });
    useSessionStore.getState().markRead("s1");
    expect(useSessionStore.getState().unreadSessionIds.has("s1")).toBe(false);
  });

  it("setActiveSession clears unread after 1500ms", () => {
    seedSessions();
    useSessionStore.setState({ unreadSessionIds: new Set(["s2"]) });
    useSessionStore.getState().setActiveSession("s2");
    // Not cleared immediately
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(false);
  });

  it("setActiveSession cancels timer if session changes before 1500ms", () => {
    seedSessions();
    useSessionStore.setState({ unreadSessionIds: new Set(["s2"]) });
    useSessionStore.getState().setActiveSession("s2");
    // Switch away before timer fires
    vi.advanceTimersByTime(500);
    useSessionStore.getState().setActiveSession("s1");
    vi.advanceTimersByTime(1500);
    // s2 should still be unread — timer was cancelled
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(true);
  });

  it("deleteSession removes from unread set", async () => {
    seedSessions();
    useSessionStore.setState({ unreadSessionIds: new Set(["s2"]) });
    await useSessionStore.getState().deleteSession("s2");
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(false);
  });

  it("archiveSession removes from unread set", async () => {
    seedSessions();
    useSessionStore.setState({ unreadSessionIds: new Set(["s2"]) });
    await useSessionStore.getState().archiveSession("s2");
    expect(useSessionStore.getState().unreadSessionIds.has("s2")).toBe(false);
  });
});
