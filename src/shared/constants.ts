export const IPC = {
  // Sessions
  SESSIONS_CREATE: "sessions:create",
  SESSIONS_RESUME: "sessions:resume",
  SESSIONS_SEND_MESSAGE: "sessions:sendMessage",
  SESSIONS_STOP: "sessions:stop",
  SESSIONS_DELETE: "sessions:delete",
  SESSIONS_ARCHIVE: "sessions:archive",
  SESSIONS_RESTORE: "sessions:restore",
  SESSIONS_LIST: "sessions:list",
  SESSIONS_LIST_ARCHIVED: "sessions:listArchived",
  SESSIONS_GET_MESSAGES: "sessions:getMessages",
  SESSIONS_RESPOND_PERMISSION: "sessions:respondPermission",

  // Repos
  REPOS_ADD: "repos:add",
  REPOS_REMOVE: "repos:remove",
  REPOS_LIST: "repos:list",
  REPOS_SELECT_DIALOG: "repos:selectDialog",

  // Worktrees
  WORKTREES_LIST: "worktrees:list",
  WORKTREES_CLEANUP: "worktrees:cleanup",

  // Voice
  VOICE_START_RECORDING: "voice:startRecording",
  VOICE_STOP_AND_TRANSCRIBE: "voice:stopAndTranscribe",

  // Diffs
  DIFFS_GET_SESSION: "diffs:getSession",
  DIFFS_GET_FILE: "diffs:getFile",

  // Settings
  SETTINGS_GET_SHORTCUTS: "settings:getShortcuts",
  SETTINGS_SAVE_SHORTCUTS: "settings:saveShortcuts",
  SETTINGS_GET: "settings:get",
  SETTINGS_SAVE: "settings:save",

  // App
  APP_GET_INFO: "app:getInfo",

  // Events (main → renderer)
  EVENT_AGENT: "event:agent",
  EVENT_SESSION_STATUS: "event:sessionStatus",
} as const;
