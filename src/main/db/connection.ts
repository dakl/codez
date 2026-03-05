import Database from "better-sqlite3";

export const SCHEMA_VERSION = 2;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS repos (
    path TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_used TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    repo_path TEXT NOT NULL REFERENCES repos(path) ON DELETE CASCADE,
    worktree_path TEXT NOT NULL,
    agent_type TEXT NOT NULL DEFAULT 'claude',
    agent_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_name TEXT,
    tool_id TEXT,
    is_error INTEGER NOT NULL DEFAULT 0,
    thinking TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_repo_path ON sessions(repo_path);
  CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
`;

const MIGRATIONS: Record<number, string> = {
  2: "ALTER TABLE messages ADD COLUMN thinking TEXT",
};

export function createDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(SCHEMA);

  // Run migrations for existing databases
  const currentVersion = (db.pragma("user_version", { simple: true }) as number) ?? 0;
  for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version++) {
    const migration = MIGRATIONS[version];
    if (migration) {
      try {
        db.exec(migration);
      } catch {
        // Column may already exist if schema was created fresh
      }
    }
  }

  db.pragma(`user_version = ${SCHEMA_VERSION}`);

  return db;
}
