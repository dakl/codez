export type AgentType = "claude" | "gemini";

export type SessionStatus = "idle" | "running" | "waiting_for_input" | "paused" | "completed" | "error" | "archived";

export interface AgentConfig {
  type: AgentType;
  binaryPath: string;
  extraFlags: string[];
  apiKey?: string;
}

export interface SessionInfo {
  id: string;
  repoPath: string;
  worktreePath: string;
  agentType: AgentType;
  agentSessionId: string | null;
  status: SessionStatus;
  name: string;
  createdAt: string;
  lastActiveAt: string;
}

export type AgentEventType =
  | "text_delta"
  | "text_complete"
  | "tool_use_start"
  | "tool_use_delta"
  | "tool_use_complete"
  | "tool_result"
  | "tool_use_summary"
  | "thinking_delta"
  | "message_complete"
  | "session_start"
  | "session_end"
  | "waiting_for_input"
  | "directory_permission_denied"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool_use" | "tool_result" | "system";
  content: string;
  toolName?: string;
  toolId?: string;
  isError?: boolean;
  thinking?: string;
  timestamp: string;
}

export interface ChangedFile {
  path: string;
  relativePath: string;
  status: "added" | "modified" | "deleted" | "renamed";
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}
