import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createDatabase } from "./connection";
import { createRepo } from "./repos";
import {
  createSession,
  getSession,
  listSessions,
  updateSessionStatus,
  updateAgentSessionId,
  deleteSession,
  archiveSession,
  restoreSession,
  listArchivedSessions,
} from "./sessions";

let db: Database.Database;

beforeEach(() => {
  db = createDatabase(":memory:");
  createRepo(db, "/Users/dan/project", "project");
});

afterEach(() => {
  db.close();
});

describe("createSession", () => {
  it("inserts a session and returns it", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/Users/dan/project/.codez/worktrees/abc",
      agentType: "claude",
      name: "fix the bug",
    });
    expect(session.id).toBeDefined();
    expect(session.repoPath).toBe("/Users/dan/project");
    expect(session.worktreePath).toBe("/Users/dan/project/.codez/worktrees/abc");
    expect(session.agentType).toBe("claude");
    expect(session.status).toBe("idle");
    expect(session.name).toBe("fix the bug");
  });
});

describe("getSession", () => {
  it("returns the session by id", () => {
    const created = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    const session = getSession(db, created.id);
    expect(session).not.toBeNull();
    expect(session!.name).toBe("test");
  });

  it("returns null for non-existent id", () => {
    expect(getSession(db, "nonexistent")).toBeNull();
  });
});

describe("listSessions", () => {
  it("returns empty array when no sessions exist", () => {
    expect(listSessions(db)).toEqual([]);
  });

  it("returns all sessions ordered by last_active_at desc", () => {
    createSession(db, { repoPath: "/Users/dan/project", worktreePath: "/tmp/a", agentType: "claude", name: "first" });
    createSession(db, { repoPath: "/Users/dan/project", worktreePath: "/tmp/b", agentType: "claude", name: "second" });
    const sessions = listSessions(db);
    expect(sessions.length).toBe(2);
  });

  it("filters by repoPath when provided", () => {
    createRepo(db, "/Users/dan/other", "other");
    createSession(db, { repoPath: "/Users/dan/project", worktreePath: "/tmp/a", agentType: "claude", name: "a" });
    createSession(db, { repoPath: "/Users/dan/other", worktreePath: "/tmp/b", agentType: "claude", name: "b" });
    const sessions = listSessions(db, "/Users/dan/project");
    expect(sessions.length).toBe(1);
    expect(sessions[0].name).toBe("a");
  });
});

describe("updateSessionStatus", () => {
  it("updates the status field", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    updateSessionStatus(db, session.id, "running");
    const updated = getSession(db, session.id)!;
    expect(updated.status).toBe("running");
  });
});

describe("updateAgentSessionId", () => {
  it("stores the agent's own session id for resume", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    updateAgentSessionId(db, session.id, "claude-session-xyz");
    const updated = getSession(db, session.id)!;
    expect(updated.agentSessionId).toBe("claude-session-xyz");
  });
});

describe("archiveSession", () => {
  it("sets status to archived", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    archiveSession(db, session.id);
    const updated = getSession(db, session.id)!;
    expect(updated.status).toBe("archived");
  });

  it("hides session from listSessions", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    archiveSession(db, session.id);
    expect(listSessions(db)).toEqual([]);
    expect(listSessions(db, "/Users/dan/project")).toEqual([]);
  });
});

describe("restoreSession", () => {
  it("sets status back to idle", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    archiveSession(db, session.id);
    restoreSession(db, session.id);
    const updated = getSession(db, session.id)!;
    expect(updated.status).toBe("idle");
  });

  it("makes session visible in listSessions again", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    archiveSession(db, session.id);
    restoreSession(db, session.id);
    expect(listSessions(db)).toHaveLength(1);
  });
});

describe("listArchivedSessions", () => {
  it("returns only archived sessions", () => {
    const session1 = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/a",
      agentType: "claude",
      name: "active",
    });
    const session2 = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/b",
      agentType: "claude",
      name: "archived",
    });
    archiveSession(db, session2.id);

    const archived = listArchivedSessions(db);
    expect(archived).toHaveLength(1);
    expect(archived[0].name).toBe("archived");
  });

  it("filters by repoPath", () => {
    createRepo(db, "/Users/dan/other", "other");
    const session1 = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/a",
      agentType: "claude",
      name: "a",
    });
    const session2 = createSession(db, {
      repoPath: "/Users/dan/other",
      worktreePath: "/tmp/b",
      agentType: "claude",
      name: "b",
    });
    archiveSession(db, session1.id);
    archiveSession(db, session2.id);

    const archived = listArchivedSessions(db, "/Users/dan/project");
    expect(archived).toHaveLength(1);
    expect(archived[0].name).toBe("a");
  });

  it("returns empty array when no archived sessions exist", () => {
    expect(listArchivedSessions(db)).toEqual([]);
  });
});

describe("deleteSession", () => {
  it("removes the session", () => {
    const session = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt",
      agentType: "claude",
      name: "test",
    });
    deleteSession(db, session.id);
    expect(getSession(db, session.id)).toBeNull();
  });
});
