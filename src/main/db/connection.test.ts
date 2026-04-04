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

  it("migration v5 adds binary_name and extra_args columns to sessions", () => {
    const dbPath = path.join(tempDir, "migrate-v5.db");
    db = createDatabase(dbPath);
    // Both columns should be queryable on a fresh database
    expect(() => {
      db.exec("SELECT binary_name, extra_args FROM sessions LIMIT 1");
    }).not.toThrow();
  });

  it("migration v5 does not break existing rows (columns default to null)", () => {
    db = createDatabase(":memory:");
    // Insert a repo first (required FK)
    db.exec("INSERT INTO repos (path, name) VALUES ('/repo', 'repo')");
    db.exec(
      "INSERT INTO sessions (id, repo_path, worktree_path, agent_type, name, sort_order) VALUES ('s1', '/repo', '/repo', 'claude', 'test', 0)",
    );
    const row = db.prepare("SELECT binary_name, extra_args FROM sessions WHERE id = 's1'").get() as {
      binary_name: string | null;
      extra_args: string | null;
    };
    expect(row.binary_name).toBeNull();
    expect(row.extra_args).toBeNull();
  });

  it("migration v6 adds preset_name column to sessions", () => {
    db = createDatabase(":memory:");
    expect(() => {
      db.exec("SELECT preset_name FROM sessions LIMIT 1");
    }).not.toThrow();
  });

  it("migration v7 adds env_vars column to sessions", () => {
    db = createDatabase(":memory:");
    expect(() => {
      db.exec("SELECT env_vars FROM sessions LIMIT 1");
    }).not.toThrow();
  });

  it("all profile columns default to null for new rows", () => {
    db = createDatabase(":memory:");
    db.exec("INSERT INTO repos (path, name) VALUES ('/repo', 'repo')");
    db.exec(
      "INSERT INTO sessions (id, repo_path, worktree_path, agent_type, name, sort_order) VALUES ('s1', '/repo', '/repo', 'claude', 'test', 0)",
    );
    const row = db.prepare("SELECT preset_name, env_vars FROM sessions WHERE id = 's1'").get() as {
      preset_name: string | null;
      env_vars: string | null;
    };
    expect(row.preset_name).toBeNull();
    expect(row.env_vars).toBeNull();
  });
});
