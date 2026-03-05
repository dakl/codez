import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  AgentType,
  ChangedFile,
  SessionInfo,
  SessionStatus,
} from "./agent-types";

export interface RepoInfo {
  path: string;
  name: string;
  lastUsed: string;
}

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";

export type ThemeId = "midnight" | "ember" | "forest" | "snow" | "sand" | "dawn";

export interface AppSettings {
  shortcuts?: Record<string, string>;
  selectedRepoPath?: string;
  voiceEnabled?: boolean;
  whisperModel?: string;
  pushToTalkKey?: string;
  notificationSound?: boolean;
  permissionMode?: PermissionMode;
  agentConfigs?: Record<string, Partial<AgentConfig>>;
  theme?: ThemeId;
}

export interface ElectronAPI {
  // Sessions
  createSession: (repoPath: string, agentType: AgentType, name?: string) => Promise<SessionInfo>;
  resumeSession: (sessionId: string) => Promise<SessionInfo>;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  restoreSession: (sessionId: string) => Promise<void>;
  listSessions: (repoPath?: string) => Promise<SessionInfo[]>;
  listArchivedSessions: (repoPath?: string) => Promise<SessionInfo[]>;
  getSessionMessages: (sessionId: string) => Promise<AgentMessage[]>;
  respondPermission: (
    sessionId: string,
    requestId: string,
    approved: boolean,
    updatedInput?: Record<string, unknown>,
  ) => Promise<void>;

  // Repos
  addRepo: (path: string) => Promise<RepoInfo>;
  removeRepo: (path: string) => Promise<void>;
  listRepos: () => Promise<RepoInfo[]>;
  selectRepoDialog: () => Promise<RepoInfo | null>;

  // Worktrees
  listWorktrees: (repoPath: string) => Promise<string[]>;
  cleanupWorktree: (sessionId: string) => Promise<void>;

  // Voice
  startRecording: () => Promise<void>;
  stopRecordingAndTranscribe: () => Promise<string>;

  // Diffs
  getSessionDiffs: (sessionId: string) => Promise<ChangedFile[]>;
  getFileDiff: (sessionId: string, filePath: string) => Promise<string>;

  // Settings
  getShortcutOverrides: () => Promise<Record<string, string>>;
  saveShortcutOverrides: (overrides: Record<string, string>) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>;

  // App
  getAppInfo: () => Promise<{ name: string; version: string }>;

  // Events (main → renderer)
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void;
  onSessionStatusChanged: (callback: (sessionId: string, status: SessionStatus) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
