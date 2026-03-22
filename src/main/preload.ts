import { contextBridge, ipcRenderer } from "electron";

// IPC channel names inlined — preload runs in a sandboxed context
// and can't require external modules. Keep in sync with src/shared/constants.ts.
const CH = {
  SESSIONS_CREATE: "sessions:create",
  SESSIONS_RESUME: "sessions:resume",
  SESSIONS_SEND_MESSAGE: "sessions:sendMessage",
  SESSIONS_STOP: "sessions:stop",
  SESSIONS_DELETE: "sessions:delete",
  SESSIONS_ARCHIVE: "sessions:archive",
  SESSIONS_RESTORE: "sessions:restore",
  SESSIONS_LIST: "sessions:list",
  SESSIONS_LIST_ARCHIVED: "sessions:listArchived",
  SESSIONS_REORDER: "sessions:reorder",
  SESSIONS_GET_MESSAGES: "sessions:getMessages",
  REPOS_ADD: "repos:add",
  REPOS_REMOVE: "repos:remove",
  REPOS_LIST: "repos:list",
  REPOS_SELECT_DIALOG: "repos:selectDialog",
  REPOS_GET_BRANCH: "repos:getBranch",
  WORKTREES_LIST: "worktrees:list",
  WORKTREES_CLEANUP: "worktrees:cleanup",
  VOICE_START_RECORDING: "voice:startRecording",
  VOICE_STOP_AND_TRANSCRIBE: "voice:stopAndTranscribe",
  DIFFS_GET_SESSION: "diffs:getSession",
  DIFFS_GET_FILE: "diffs:getFile",
  SETTINGS_GET_SHORTCUTS: "settings:getShortcuts",
  SETTINGS_SAVE_SHORTCUTS: "settings:saveShortcuts",
  SETTINGS_GET: "settings:get",
  SETTINGS_SAVE: "settings:save",
  SETTINGS_SELECT_WORKTREE_DIR: "settings:selectWorktreeDir",
  PTY_CREATE: "pty:create",
  PTY_INPUT: "pty:input",
  PTY_RESIZE: "pty:resize",
  PTY_KILL: "pty:kill",
  FONTS_LIST: "fonts:list",
  SETTINGS_GET_ICON_DATA_URLS: "settings:getIconDataUrls",
  SETTINGS_SET_APP_ICON: "settings:setAppIcon",
  APP_GET_INFO: "app:getInfo",
  UPDATER_CHECK: "updater:check",
  UPDATER_DOWNLOAD: "updater:download",
  UPDATER_QUIT_AND_INSTALL: "updater:quitAndInstall",
  EVENT_AGENT: "event:agent",
  EVENT_SESSION_STATUS: "event:sessionStatus",
  EVENT_PTY_DATA: "event:ptyData",
  EVENT_PTY_EXIT: "event:ptyExit",
  EVENT_UPDATE_AVAILABLE: "updater:update-available",
  EVENT_UPDATE_DOWNLOADED: "updater:update-downloaded",
  EVENT_UPDATE_PROGRESS: "updater:progress",
  EVENT_UPDATE_ERROR: "updater:error",
  EVENT_MENU_SETTINGS: "menu:settings",
} as const;

const api = {
  // Sessions
  createSession: (repoPath: string, agentType: string, branchName?: string, name?: string) =>
    ipcRenderer.invoke(CH.SESSIONS_CREATE, repoPath, agentType, branchName, name),
  resumeSession: (sessionId: string) => ipcRenderer.invoke(CH.SESSIONS_RESUME, sessionId),
  sendMessage: (sessionId: string, message: string) => ipcRenderer.invoke(CH.SESSIONS_SEND_MESSAGE, sessionId, message),
  stopSession: (sessionId: string) => ipcRenderer.invoke(CH.SESSIONS_STOP, sessionId),
  deleteSession: (sessionId: string) => ipcRenderer.invoke(CH.SESSIONS_DELETE, sessionId),
  archiveSession: (sessionId: string) => ipcRenderer.invoke(CH.SESSIONS_ARCHIVE, sessionId),
  restoreSession: (sessionId: string) => ipcRenderer.invoke(CH.SESSIONS_RESTORE, sessionId),
  listSessions: (repoPath?: string) => ipcRenderer.invoke(CH.SESSIONS_LIST, repoPath),
  listArchivedSessions: (repoPath?: string) => ipcRenderer.invoke(CH.SESSIONS_LIST_ARCHIVED, repoPath),
  reorderSessions: (sessionIds: string[]) => ipcRenderer.invoke(CH.SESSIONS_REORDER, sessionIds),
  getSessionMessages: (sessionId: string) => ipcRenderer.invoke(CH.SESSIONS_GET_MESSAGES, sessionId),

  // Repos
  addRepo: (repoPath: string) => ipcRenderer.invoke(CH.REPOS_ADD, repoPath),
  removeRepo: (repoPath: string) => ipcRenderer.invoke(CH.REPOS_REMOVE, repoPath),
  listRepos: () => ipcRenderer.invoke(CH.REPOS_LIST),
  selectRepoDialog: () => ipcRenderer.invoke(CH.REPOS_SELECT_DIALOG),
  getRepoBranch: (repoPath: string) => ipcRenderer.invoke(CH.REPOS_GET_BRANCH, repoPath),

  // Worktrees
  listWorktrees: (repoPath: string) => ipcRenderer.invoke(CH.WORKTREES_LIST, repoPath),
  cleanupWorktree: (sessionId: string) => ipcRenderer.invoke(CH.WORKTREES_CLEANUP, sessionId),

  // Voice
  startRecording: () => ipcRenderer.invoke(CH.VOICE_START_RECORDING),
  stopRecordingAndTranscribe: () => ipcRenderer.invoke(CH.VOICE_STOP_AND_TRANSCRIBE),

  // Diffs
  getSessionDiffs: (sessionId: string) => ipcRenderer.invoke(CH.DIFFS_GET_SESSION, sessionId),
  getFileDiff: (sessionId: string, filePath: string) => ipcRenderer.invoke(CH.DIFFS_GET_FILE, sessionId, filePath),

  // Settings
  getShortcutOverrides: () => ipcRenderer.invoke(CH.SETTINGS_GET_SHORTCUTS),
  saveShortcutOverrides: (overrides: Record<string, string>) =>
    ipcRenderer.invoke(CH.SETTINGS_SAVE_SHORTCUTS, overrides),
  getSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke(CH.SETTINGS_SAVE, settings),
  selectWorktreeDir: () => ipcRenderer.invoke(CH.SETTINGS_SELECT_WORKTREE_DIR),
  // Fonts
  listFonts: () => ipcRenderer.invoke(CH.FONTS_LIST),

  // Icons
  getIconDataUrls: () => ipcRenderer.invoke(CH.SETTINGS_GET_ICON_DATA_URLS),
  setAppIcon: (iconId: string) => ipcRenderer.invoke(CH.SETTINGS_SET_APP_ICON, iconId),

  // PTY
  ptyCreate: (sessionId: string, agentType: string, worktreePath: string, cols: number, rows: number) =>
    ipcRenderer.invoke(CH.PTY_CREATE, sessionId, agentType, worktreePath, cols, rows),
  ptyInput: (sessionId: string, data: string) => ipcRenderer.invoke(CH.PTY_INPUT, sessionId, data),
  ptyResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke(CH.PTY_RESIZE, sessionId, cols, rows),
  ptyKill: (sessionId: string) => ipcRenderer.invoke(CH.PTY_KILL, sessionId),

  // App
  getAppInfo: () => ipcRenderer.invoke(CH.APP_GET_INFO),

  // Updater
  checkForUpdate: () => ipcRenderer.invoke(CH.UPDATER_CHECK),
  downloadUpdate: () => ipcRenderer.invoke(CH.UPDATER_DOWNLOAD),
  quitAndInstall: () => ipcRenderer.invoke(CH.UPDATER_QUIT_AND_INSTALL),

  // Events (main → renderer)
  onAgentEvent: (callback: (event: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on(CH.EVENT_AGENT, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_AGENT, handler);
  },
  onSessionStatusChanged: (callback: (sessionId: string, status: string) => void) => {
    const handler = (_event: unknown, sessionId: string, status: string) => callback(sessionId, status);
    ipcRenderer.on(CH.EVENT_SESSION_STATUS, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_SESSION_STATUS, handler);
  },
  onPtyData: (callback: (sessionId: string, data: string) => void) => {
    const handler = (_event: unknown, sessionId: string, data: string) => callback(sessionId, data);
    ipcRenderer.on(CH.EVENT_PTY_DATA, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_PTY_DATA, handler);
  },
  onPtyExit: (callback: (sessionId: string, exitCode: number) => void) => {
    const handler = (_event: unknown, sessionId: string, exitCode: number) => callback(sessionId, exitCode);
    ipcRenderer.on(CH.EVENT_PTY_EXIT, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_PTY_EXIT, handler);
  },
  onUpdateAvailable: (callback: (version: string) => void) => {
    const handler = (_event: unknown, version: string) => callback(version);
    ipcRenderer.on(CH.EVENT_UPDATE_AVAILABLE, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_UPDATE_AVAILABLE, handler);
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const handler = (_event: unknown, info: { version: string }) => callback(info);
    ipcRenderer.on(CH.EVENT_UPDATE_DOWNLOADED, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_UPDATE_DOWNLOADED, handler);
  },
  onUpdateProgress: (
    callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void,
  ) => {
    const handler = (
      _event: unknown,
      progress: { percent: number; bytesPerSecond: number; transferred: number; total: number },
    ) => callback(progress);
    ipcRenderer.on(CH.EVENT_UPDATE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_UPDATE_PROGRESS, handler);
  },
  onUpdateError: (callback: (info: { error: string }) => void) => {
    const handler = (_event: unknown, info: { error: string }) => callback(info);
    ipcRenderer.on(CH.EVENT_UPDATE_ERROR, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_UPDATE_ERROR, handler);
  },
  onMenuSettings: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(CH.EVENT_MENU_SETTINGS, handler);
    return () => ipcRenderer.removeListener(CH.EVENT_MENU_SETTINGS, handler);
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
