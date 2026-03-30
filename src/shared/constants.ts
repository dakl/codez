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
  SESSIONS_REORDER: "sessions:reorder",
  SESSIONS_GET_MESSAGES: "sessions:getMessages",
  // Repos
  REPOS_ADD: "repos:add",
  REPOS_REMOVE: "repos:remove",
  REPOS_LIST: "repos:list",
  REPOS_SELECT_DIALOG: "repos:selectDialog",
  REPOS_GET_BRANCH: "repos:getBranch",
  REPOS_LIST_BRANCHES: "repos:listBranches",
  REPOS_GET_DEFAULT_BRANCH: "repos:getDefaultBranch",

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
  SETTINGS_SELECT_WORKTREE_DIR: "settings:selectWorktreeDir",
  // Fonts
  FONTS_LIST: "fonts:list",
  // Icons
  SETTINGS_GET_ICON_DATA_URLS: "settings:getIconDataUrls",
  SETTINGS_SET_APP_ICON: "settings:setAppIcon",

  // App
  APP_GET_INFO: "app:getInfo",

  // PTY
  PTY_CREATE: "pty:create",
  PTY_INPUT: "pty:input",
  PTY_RESIZE: "pty:resize",
  PTY_KILL: "pty:kill",

  // Updater
  UPDATER_CHECK: "updater:check",
  UPDATER_DOWNLOAD: "updater:download",
  UPDATER_QUIT_AND_INSTALL: "updater:quitAndInstall",

  // Events (main → renderer)
  EVENT_AGENT: "event:agent",
  EVENT_SESSION_STATUS: "event:sessionStatus",
  EVENT_PTY_DATA: "event:ptyData",
  EVENT_PTY_EXIT: "event:ptyExit",
  EVENT_UPDATE_AVAILABLE: "updater:update-available",
  EVENT_UPDATE_DOWNLOADED: "updater:update-downloaded",
  EVENT_UPDATE_PROGRESS: "updater:progress",
  EVENT_UPDATE_ERROR: "updater:error",
  EVENT_MENU_SETTINGS: "menu:settings",
  EVENT_NAVIGATE_TO_SESSION: "event:navigateToSession",
} as const;
