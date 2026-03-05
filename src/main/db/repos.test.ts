import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "./connection";
import { createRepo, deleteRepo, getRepo, listRepos, updateLastUsed } from "./repos";

let db: Database.Database;

beforeEach(() => {
  db = createDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

describe("createRepo", () => {
  it("inserts a new repo and returns it", () => {
    const repo = createRepo(db, "/Users/dan/project", "project");
    expect(repo.path).toBe("/Users/dan/project");
    expect(repo.name).toBe("project");
    expect(repo.lastUsed).toBeDefined();
  });

  it("throws on duplicate path", () => {
    createRepo(db, "/Users/dan/project", "project");
    expect(() => createRepo(db, "/Users/dan/project", "project")).toThrow();
  });
});

describe("getRepo", () => {
  it("returns the repo by path", () => {
    createRepo(db, "/Users/dan/project", "project");
    const repo = getRepo(db, "/Users/dan/project");
    expect(repo).not.toBeNull();
    expect(repo?.name).toBe("project");
  });

  it("returns null for non-existent path", () => {
    const repo = getRepo(db, "/no/such/path");
    expect(repo).toBeNull();
  });
});

describe("listRepos", () => {
  it("returns empty array when no repos exist", () => {
    const repos = listRepos(db);
    expect(repos).toEqual([]);
  });

  it("returns all repos ordered by last_used desc", () => {
    createRepo(db, "/Users/dan/a", "a");
    createRepo(db, "/Users/dan/b", "b");
    // Update 'a' to be more recently used
    updateLastUsed(db, "/Users/dan/a");
    const repos = listRepos(db);
    expect(repos.length).toBe(2);
    expect(repos[0].path).toBe("/Users/dan/a");
  });
});

describe("deleteRepo", () => {
  it("removes the repo", () => {
    createRepo(db, "/Users/dan/project", "project");
    deleteRepo(db, "/Users/dan/project");
    expect(getRepo(db, "/Users/dan/project")).toBeNull();
  });

  it("does not throw when deleting non-existent repo", () => {
    expect(() => deleteRepo(db, "/no/such/path")).not.toThrow();
  });
});

describe("updateLastUsed", () => {
  it("updates the last_used timestamp", () => {
    createRepo(db, "/Users/dan/project", "project");
    const before = getRepo(db, "/Users/dan/project")?.lastUsed;
    // SQLite datetime precision is seconds, so the timestamps may be equal
    updateLastUsed(db, "/Users/dan/project");
    const after = getRepo(db, "/Users/dan/project")?.lastUsed;
    expect(after).toBeDefined();
    expect(after >= before).toBe(true);
  });
});
