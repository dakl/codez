import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createDatabase } from "./connection";
import { createRepo } from "./repos";
import { createSession } from "./sessions";
import { createMessage, listMessages, deleteMessagesBySession } from "./messages";

let db: Database.Database;
let sessionId: string;

beforeEach(() => {
  db = createDatabase(":memory:");
  createRepo(db, "/Users/dan/project", "project");
  const session = createSession(db, {
    repoPath: "/Users/dan/project",
    worktreePath: "/tmp/wt",
    agentType: "claude",
    name: "test",
  });
  sessionId = session.id;
});

afterEach(() => {
  db.close();
});

describe("createMessage", () => {
  it("inserts a message and returns it", () => {
    const message = createMessage(db, {
      sessionId,
      role: "user",
      content: "Fix the bug",
    });
    expect(message.id).toBeDefined();
    expect(message.sessionId).toBe(sessionId);
    expect(message.role).toBe("user");
    expect(message.content).toBe("Fix the bug");
    expect(message.isError).toBe(false);
  });

  it("stores tool metadata when provided", () => {
    const message = createMessage(db, {
      sessionId,
      role: "tool_use",
      content: '{"file": "main.ts"}',
      toolName: "Read",
      toolId: "tool_123",
    });
    expect(message.toolName).toBe("Read");
    expect(message.toolId).toBe("tool_123");
  });

  it("stores isError flag", () => {
    const message = createMessage(db, {
      sessionId,
      role: "tool_result",
      content: "Error: file not found",
      isError: true,
    });
    expect(message.isError).toBe(true);
  });

  it("stores thinking text when provided", () => {
    const message = createMessage(db, {
      sessionId,
      role: "assistant",
      content: "The answer is 42",
      thinking: "Let me reason about this step by step...",
    });
    expect(message.thinking).toBe("Let me reason about this step by step...");
  });

  it("returns undefined thinking when not provided", () => {
    const message = createMessage(db, {
      sessionId,
      role: "assistant",
      content: "Hello",
    });
    expect(message.thinking).toBeUndefined();
  });
});

describe("listMessages", () => {
  it("returns empty array when no messages exist", () => {
    expect(listMessages(db, sessionId)).toEqual([]);
  });

  it("returns messages ordered by timestamp asc", () => {
    createMessage(db, { sessionId, role: "user", content: "first" });
    createMessage(db, { sessionId, role: "assistant", content: "second" });
    const messages = listMessages(db, sessionId);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe("first");
    expect(messages[1].content).toBe("second");
  });

  it("does not return messages from other sessions", () => {
    const otherSession = createSession(db, {
      repoPath: "/Users/dan/project",
      worktreePath: "/tmp/wt2",
      agentType: "claude",
      name: "other",
    });
    createMessage(db, { sessionId, role: "user", content: "mine" });
    createMessage(db, { sessionId: otherSession.id, role: "user", content: "theirs" });
    const messages = listMessages(db, sessionId);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("mine");
  });
});

describe("deleteMessagesBySession", () => {
  it("removes all messages for a session", () => {
    createMessage(db, { sessionId, role: "user", content: "hello" });
    createMessage(db, { sessionId, role: "assistant", content: "hi" });
    deleteMessagesBySession(db, sessionId);
    expect(listMessages(db, sessionId)).toEqual([]);
  });
});
