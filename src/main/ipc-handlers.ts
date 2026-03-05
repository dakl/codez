import { ipcMain, dialog, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import type Database from "better-sqlite3";
import { IPC } from "../shared/constants.js";
import { createRepo, listRepos, deleteRepo } from "./db/repos.js";
import { createSession, listSessions, deleteSession, archiveSession, restoreSession, listArchivedSessions } from "./db/sessions.js";
import { listMessages, deleteMessagesBySession, createMessage } from "./db/messages.js";
import { SessionLifecycle } from "./services/session-lifecycle.js";
import { readSettings, writeSettings, getShortcutOverrides, saveShortcutOverrides } from "./settings.js";
import type { AgentType } from "../shared/agent-types.js";

interface RegisterHandlersOptions {
  db: Database.Database;
  settingsPath: string;
  getMainWindow: () => BrowserWindow | null;
}

export function registerIpcHandlers(options: RegisterHandlersOptions): void {
  const { db, settingsPath, getMainWindow } = options;

  // Strip CLAUDECODE env var so spawned agents don't think they're nested
  const cleanEnv = { ...process.env };
  delete cleanEnv.CLAUDECODE;

  const lifecycle = new SessionLifecycle({
    db,
    spawnFn: (binary, args, spawnOptions) =>
      spawn(binary, args, { ...spawnOptions, stdio: ["ignore", "pipe", "pipe"], env: cleanEnv }),
    getAllowedTools: () => {
      const settings = readSettings(settingsPath);
      return settings.agentConfigs?.claude?.defaultPermissions ?? [];
    },
    getPermissionMode: () => {
      const settings = readSettings(settingsPath);
      return settings.permissionMode ?? "default";
    },
  });

  // Forward agent events to the renderer
  lifecycle.on("agentEvent", (event) => {
    const window = getMainWindow();
    if (window) {
      window.webContents.send(IPC.EVENT_AGENT, event);
    }
  });

  // Forward status changes to the renderer
  lifecycle.on("statusChanged", (sessionId: string, status: string) => {
    const window = getMainWindow();
    if (window) {
      window.webContents.send(IPC.EVENT_SESSION_STATUS, sessionId, status);
    }
  });

  // --- Sessions ---

  ipcMain.handle(IPC.SESSIONS_CREATE, (_event, repoPath: string, agentType: AgentType, name?: string) => {
    const sessionName = name || `Session ${Date.now()}`;
    const worktreePath = repoPath; // worktree manager comes in Phase 3
    return createSession(db, { repoPath, worktreePath, agentType, name: sessionName });
  });

  ipcMain.handle(IPC.SESSIONS_SEND_MESSAGE, (_event, sessionId: string, message: string) => {
    createMessage(db, { sessionId, role: "user", content: message });
    lifecycle.runPrompt(sessionId, message);
  });

  ipcMain.handle(IPC.SESSIONS_STOP, (_event, sessionId: string) => {
    lifecycle.stopSession(sessionId);
  });

  ipcMain.handle(IPC.SESSIONS_LIST, (_event, repoPath?: string) => {
    return listSessions(db, repoPath);
  });

  ipcMain.handle(IPC.SESSIONS_GET_MESSAGES, (_event, sessionId: string) => {
    return listMessages(db, sessionId);
  });

  ipcMain.handle(IPC.SESSIONS_DELETE, (_event, sessionId: string) => {
    deleteMessagesBySession(db, sessionId);
    deleteSession(db, sessionId);
  });

  ipcMain.handle(IPC.SESSIONS_ARCHIVE, (_event, sessionId: string) => {
    lifecycle.stopSession(sessionId);
    archiveSession(db, sessionId);
  });

  ipcMain.handle(IPC.SESSIONS_RESTORE, (_event, sessionId: string) => {
    restoreSession(db, sessionId);
  });

  ipcMain.handle(IPC.SESSIONS_LIST_ARCHIVED, (_event, repoPath?: string) => {
    return listArchivedSessions(db, repoPath);
  });

  ipcMain.handle(
    IPC.SESSIONS_RESPOND_PERMISSION,
    (_event, sessionId: string, requestId: string, approved: boolean, updatedInput?: Record<string, unknown>) => {
      lifecycle.respondPermission(sessionId, requestId, approved, updatedInput);
    },
  );

  // --- Repos ---

  ipcMain.handle(IPC.REPOS_ADD, (_event, repoPath: string) => {
    const name = repoPath.split("/").pop() || repoPath;
    return createRepo(db, repoPath, name);
  });

  ipcMain.handle(IPC.REPOS_REMOVE, (_event, repoPath: string) => {
    deleteRepo(db, repoPath);
  });

  ipcMain.handle(IPC.REPOS_LIST, () => {
    return listRepos(db);
  });

  ipcMain.handle(IPC.REPOS_SELECT_DIALOG, async () => {
    const window = getMainWindow();
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
      message: "Select a git repository",
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const repoPath = result.filePaths[0];
    const name = repoPath.split("/").pop() || repoPath;
    return createRepo(db, repoPath, name);
  });

  // --- Settings ---

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return readSettings(settingsPath);
  });

  ipcMain.handle(IPC.SETTINGS_SAVE, (_event, settings: Record<string, unknown>) => {
    writeSettings(settingsPath, settings);
  });

  ipcMain.handle(IPC.SETTINGS_GET_SHORTCUTS, () => {
    return getShortcutOverrides(settingsPath);
  });

  ipcMain.handle(IPC.SETTINGS_SAVE_SHORTCUTS, (_event, overrides: Record<string, string>) => {
    saveShortcutOverrides(settingsPath, overrides);
  });

  // --- App ---

  ipcMain.handle(IPC.APP_GET_INFO, () => {
    const { app } = require("electron");
    return { name: app.getName(), version: app.getVersion() };
  });
}
