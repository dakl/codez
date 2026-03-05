import crypto from "crypto";
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
  db.prepare(
    "INSERT INTO sessions (id, repo_path, worktree_path, agent_type, name) VALUES (?, ?, ?, ?, ?)",
  ).run(id, params.repoPath, params.worktreePath, params.agentType, params.name);
  return getSession(db, id)!;
}

export function getSession(db: Database.Database, sessionId: string): SessionInfo | null {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function listSessions(db: Database.Database, repoPath?: string): SessionInfo[] {
  if (repoPath) {
    const rows = db
      .prepare("SELECT * FROM sessions WHERE repo_path = ? AND status != 'archived' ORDER BY last_active_at DESC")
      .all(repoPath) as SessionRow[];
    return rows.map(rowToSession);
  }
  const rows = db.prepare("SELECT * FROM sessions WHERE status != 'archived' ORDER BY last_active_at DESC").all() as SessionRow[];
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
  db.prepare("UPDATE sessions SET status = 'idle', last_active_at = datetime('now') WHERE id = ?").run(sessionId);
}

export function listArchivedSessions(db: Database.Database, repoPath?: string): SessionInfo[] {
  if (repoPath) {
    const rows = db
      .prepare("SELECT * FROM sessions WHERE repo_path = ? AND status = 'archived' ORDER BY last_active_at DESC")
      .all(repoPath) as SessionRow[];
    return rows.map(rowToSession);
  }
  const rows = db.prepare("SELECT * FROM sessions WHERE status = 'archived' ORDER BY last_active_at DESC").all() as SessionRow[];
  return rows.map(rowToSession);
}

export function deleteSession(db: Database.Database, sessionId: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}
