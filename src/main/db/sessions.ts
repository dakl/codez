import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { AgentType, SessionInfo, SessionStatus } from "../../shared/agent-types.js";

interface SessionRow {
  id: string;
  repo_path: string;
  worktree_path: string;
  agent_type: string;
  agent_session_id: string | null;
  status: string;
  name: string;
  created_at: string;
  last_active_at: string;
  sort_order: number;
}

function rowToSession(row: SessionRow): SessionInfo {
  return {
    id: row.id,
    repoPath: row.repo_path,
    worktreePath: row.worktree_path,
    agentType: row.agent_type as AgentType,
    agentSessionId: row.agent_session_id,
    status: row.status as SessionStatus,
    name: row.name,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

interface CreateSessionParams {
  repoPath: string;
  worktreePath: string;
  agentType: AgentType;
  name: string;
}

export function createSession(db: Database.Database, params: CreateSessionParams): SessionInfo {
  const id = crypto.randomUUID();
  const maxOrder = (
    db.prepare("SELECT COALESCE(MAX(sort_order), -1) as max_order FROM sessions").get() as { max_order: number }
  ).max_order;
  db.prepare(
    "INSERT INTO sessions (id, repo_path, worktree_path, agent_type, name, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, params.repoPath, params.worktreePath, params.agentType, params.name, maxOrder + 1);
  return getSession(db, id) as SessionInfo;
}

export function getSession(db: Database.Database, sessionId: string): SessionInfo | null {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function listSessions(db: Database.Database, repoPath?: string): SessionInfo[] {
  if (repoPath) {
    const rows = db
      .prepare(
        "SELECT * FROM sessions WHERE repo_path = ? AND status != 'archived' ORDER BY sort_order ASC, last_active_at DESC",
      )
      .all(repoPath) as SessionRow[];
    return rows.map(rowToSession);
  }
  const rows = db
    .prepare("SELECT * FROM sessions WHERE status != 'archived' ORDER BY sort_order ASC, last_active_at DESC")
    .all() as SessionRow[];
  return rows.map(rowToSession);
}

export function updateSessionStatus(db: Database.Database, sessionId: string, status: SessionStatus): void {
  db.prepare("UPDATE sessions SET status = ?, last_active_at = datetime('now') WHERE id = ?").run(status, sessionId);
}

export function updateAgentSessionId(db: Database.Database, sessionId: string, agentSessionId: string): void {
  db.prepare("UPDATE sessions SET agent_session_id = ? WHERE id = ?").run(agentSessionId, sessionId);
}

export function archiveSession(db: Database.Database, sessionId: string): void {
  db.prepare("UPDATE sessions SET status = 'archived', last_active_at = datetime('now') WHERE id = ?").run(sessionId);
}

export function restoreSession(db: Database.Database, sessionId: string): void {
  const maxOrder = (
    db.prepare("SELECT COALESCE(MAX(sort_order), -1) as max_order FROM sessions").get() as { max_order: number }
  ).max_order;
  db.prepare("UPDATE sessions SET status = 'idle', last_active_at = datetime('now'), sort_order = ? WHERE id = ?").run(
    maxOrder + 1,
    sessionId,
  );
}

export function reorderSessions(db: Database.Database, sessionIds: string[]): void {
  const stmt = db.prepare("UPDATE sessions SET sort_order = ? WHERE id = ?");
  const transaction = db.transaction((ids: string[]) => {
    for (let i = 0; i < ids.length; i++) {
      stmt.run(i, ids[i]);
    }
  });
  transaction(sessionIds);
}

export function listArchivedSessions(db: Database.Database, repoPath?: string): SessionInfo[] {
  if (repoPath) {
    const rows = db
      .prepare("SELECT * FROM sessions WHERE repo_path = ? AND status = 'archived' ORDER BY last_active_at DESC")
      .all(repoPath) as SessionRow[];
    return rows.map(rowToSession);
  }
  const rows = db
    .prepare("SELECT * FROM sessions WHERE status = 'archived' ORDER BY last_active_at DESC")
    .all() as SessionRow[];
  return rows.map(rowToSession);
}

export function deleteSession(db: Database.Database, sessionId: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/** Reset running/waiting sessions to idle on startup (PTYs don't survive restarts). */
export function resetStaleSessions(db: Database.Database): number {
  const result = db
    .prepare("UPDATE sessions SET status = 'idle' WHERE status IN ('running', 'waiting_for_input')")
    .run();
  return result.changes;
}
