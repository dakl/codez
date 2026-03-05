import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, SCHEMA_VERSION } from "./connection";

let db: Database.Database;
let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codez-db-test-"));
});

afterEach(() => {
  if (db) db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("createDatabase", () => {
  it("sets WAL journal mode for file-backed databases", () => {
    const dbPath = path.join(tempDir, "test.db");
    db = createDatabase(dbPath);
    const walMode = db.pragma("journal_mode", { simple: true });
    expect(walMode).toBe("wal");
  });

  it("creates repos table", () => {
    db = createDatabase(":memory:");
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='repos'").get() as
      | { name: string }
      | undefined;
    expect(table?.name).toBe("repos");
  });

  it("creates sessions table", () => {
    db = createDatabase(":memory:");
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get() as
      | { name: string }
      | undefined;
    expect(table?.name).toBe("sessions");
  });

  it("creates messages table", () => {
    db = createDatabase(":memory:");
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get() as
      | { name: string }
      | undefined;
    expect(table?.name).toBe("messages");
  });

  it("stores schema version in user_version pragma", () => {
    db = createDatabase(":memory:");
    const version = db.pragma("user_version", { simple: true });
    expect(version).toBe(SCHEMA_VERSION);
  });

  it("is idempotent — calling twice on same db does not error", () => {
    db = createDatabase(":memory:");
    // Should not throw
    expect(() => {
      db.exec("SELECT 1 FROM repos LIMIT 1");
      db.exec("SELECT 1 FROM sessions LIMIT 1");
      db.exec("SELECT 1 FROM messages LIMIT 1");
    }).not.toThrow();
  });
});
