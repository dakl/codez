import type Database from "better-sqlite3";
import type { RepoInfo } from "../../shared/types.js";

interface RepoRow {
  path: string;
  name: string;
  last_used: string;
}

function rowToRepo(row: RepoRow): RepoInfo {
  return {
    path: row.path,
    name: row.name,
    lastUsed: row.last_used,
  };
}

export function createRepo(db: Database.Database, repoPath: string, name: string): RepoInfo {
  const stmt = db.prepare("INSERT OR IGNORE INTO repos (path, name) VALUES (?, ?)");
  stmt.run(repoPath, name);
  return getRepo(db, repoPath) as RepoInfo;
}

export function getRepo(db: Database.Database, repoPath: string): RepoInfo | null {
  const row = db.prepare("SELECT * FROM repos WHERE path = ?").get(repoPath) as RepoRow | undefined;
  return row ? rowToRepo(row) : null;
}

export function listRepos(db: Database.Database): RepoInfo[] {
  const rows = db.prepare("SELECT * FROM repos ORDER BY last_used DESC").all() as RepoRow[];
  return rows.map(rowToRepo);
}

export function deleteRepo(db: Database.Database, repoPath: string): void {
  db.prepare("DELETE FROM repos WHERE path = ?").run(repoPath);
}

export function updateLastUsed(db: Database.Database, repoPath: string): void {
  db.prepare("UPDATE repos SET last_used = datetime('now') WHERE path = ?").run(repoPath);
}
