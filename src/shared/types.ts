import type { AgentConfig, AgentEvent, AgentType, ChangedFile, SessionInfo, SessionStatus } from "./agent-types";

export interface CommandProfile {
  id: string;
  name: string;
  executable: string;
  extraArgs: string;
  envVars: string; // newline-separated KEY=VALUE pairs
}

export interface RepoInfo {
  path: string;
  name: string;
  lastUsed: string;
}

export type ThemeId = "midnight" | "ember" | "forest" | "snow" | "sand" | "dawn";

export interface FontInfo {
  familyName: string;
  monospace: boolean;
}

export interface AppSettings {
  shortcuts?: Record<string, string>;
  selectedRepoPath?: string;
  voiceEnabled?: boolean;
  whisperModel?: string;
  pushToTalkKey?: string;
  notificationSound?: boolean;
  additionalDirs?: string[];
  agentConfigs?: Record<string, Partial<AgentConfig>>;
  theme?: ThemeId;
  fontSans?: string;
  fontMono?: string;
  fontSizeMono?: number;
  terminalLineHeight?: number;
  appIcon?: string;
  /** Base directory for worktrees. Defaults to sibling of repo (<repo>--<branch>). */
  worktreeBaseDir?: string;
  commandProfiles?: CommandProfile[];
}

export interface CreateSessionOptions {
  repoPath: string;
  agentType: AgentType;
  branchName?: string;
  name?: string;
  baseBranch?: string;
  fetchFirst?: boolean;
  profileId?: string;
}

export interface ElectronAPI {
  // Sessions
  createSession: (options: CreateSessionOptions) => Promise<SessionInfo>;
  resumeSession: (sessionId: string) => Promise<SessionInfo>;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  restoreSession: (sessionId: string) => Promise<void>;
  listSessions: (repoPath?: string) => Promise<SessionInfo[]>;
  listArchivedSessions: (repoPath?: string) => Promise<SessionInfo[]>;
  reorderSessions: (sessionIds: string[]) => Promise<void>;

  // Repos
  addRepo: (path: string) => Promise<RepoInfo>;
  removeRepo: (path: string) => Promise<void>;
  listRepos: () => Promise<RepoInfo[]>;
  selectRepoDialog: () => Promise<RepoInfo | null>;
  getRepoBranch: (repoPath: string) => Promise<string | null>;
  listBranches: (repoPath: string) => Promise<string[]>;
  getDefaultBranch: (repoPath: string) => Promise<string>;

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
  selectWorktreeDir: () => Promise<string | null>;
  // Fonts
  listFonts: () => Promise<FontInfo[]>;

  // Icons
  getIconDataUrls: () => Promise<Record<string, string>>;
  setAppIcon: (iconId: string) => Promise<void>;

  // App
  getAppInfo: () => Promise<{ name: string; version: string }>;

  // PTY
  ptyCreate: (
    sessionId: string,
    agentType: AgentType,
    worktreePath: string,
    cols: number,
    rows: number,
  ) => Promise<void>;
  ptyInput: (sessionId: string, data: string) => Promise<void>;
  ptyResize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  ptyKill: (sessionId: string) => Promise<void>;

  // Updater
  checkForUpdate: () => Promise<{ available: boolean; version?: string; releaseNotes?: string; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstall: () => Promise<void>;

  // Events (main → renderer)
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void;
  onSessionStatusChanged: (callback: (sessionId: string, status: SessionStatus) => void) => () => void;
  onPtyData: (callback: (sessionId: string, data: string) => void) => () => void;
  onPtyExit: (callback: (sessionId: string, exitCode: number) => void) => () => void;
  onUpdateAvailable: (callback: (version: string) => void) => () => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
  onUpdateProgress: (
    callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void,
  ) => () => void;
  onUpdateError: (callback: (info: { error: string }) => void) => () => void;
  onMenuSettings: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
