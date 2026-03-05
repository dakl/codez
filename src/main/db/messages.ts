import crypto from "crypto";
import type Database from "better-sqlite3";
import type { AgentMessage } from "../../shared/agent-types.js";

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_name: string | null;
  tool_id: string | null;
  is_error: number;
  thinking: string | null;
  timestamp: string;
}

function rowToMessage(row: MessageRow): AgentMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as AgentMessage["role"],
    content: row.content,
    toolName: row.tool_name ?? undefined,
    toolId: row.tool_id ?? undefined,
    isError: row.is_error === 1,
    thinking: row.thinking ?? undefined,
    timestamp: row.timestamp,
  };
}

interface CreateMessageParams {
  sessionId: string;
  role: AgentMessage["role"];
  content: string;
  toolName?: string;
  toolId?: string;
  isError?: boolean;
  thinking?: string;
}

export function createMessage(db: Database.Database, params: CreateMessageParams): AgentMessage {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO messages (id, session_id, role, content, tool_name, tool_id, is_error, thinking) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, params.sessionId, params.role, params.content, params.toolName ?? null, params.toolId ?? null, params.isError ? 1 : 0, params.thinking ?? null);

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow;
  return rowToMessage(row);
}

export function listMessages(db: Database.Database, sessionId: string): AgentMessage[] {
  const rows = db
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC")
    .all(sessionId) as MessageRow[];
  return rows.map(rowToMessage);
}

export function deleteMessagesBySession(db: Database.Database, sessionId: string): void {
  db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
}
