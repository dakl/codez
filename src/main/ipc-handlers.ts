import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import type Database from "better-sqlite3";
import { app, type BrowserWindow, dialog, ipcMain } from "electron";
import { getFonts2 } from "font-list";
import * as pty from "node-pty";
import type { AgentType } from "../shared/agent-types.js";
import { IPC } from "../shared/constants.js";
import type { FontInfo } from "../shared/types.js";
import { createMessage, deleteMessagesBySession, listMessages } from "./db/messages.js";
import { createRepo, deleteRepo, listRepos } from "./db/repos.js";
import {
  archiveSession,
  clearSessionWorktree,
  createSession,
  deleteSession,
  getSession,
  listArchivedSessions,
  listSessions,
  reorderSessions,
  restoreSession,
  updateAgentSessionId,
  updateSessionStatus,
} from "./db/sessions.js";
import { applyDockIcon, getIconsDir } from "./dock.js";
import { PtyManager } from "./services/pty-manager.js";
import { SessionLifecycle } from "./services/session-lifecycle.js";
import { getShortcutOverrides, readSettings, saveShortcutOverrides, writeSettings } from "./settings.js";
import { createWorktree, removeWorktree } from "./worktree/worktree-manager.js";

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
    spawnFn: (binary, args, spawnOptions) => {
      return spawn(binary, args, { ...spawnOptions, stdio: ["ignore", "pipe", "pipe"], env: cleanEnv });
    },
  });

  // --- PTY Manager ---
  const ptyManager = new PtyManager((file, args, options) => {
    return pty.spawn(file, args, options);
  });

  ptyManager.on("data", (sessionId: string, data: string) => {
    const window = getMainWindow();
    if (window) {
      window.webContents.send(IPC.EVENT_PTY_DATA, sessionId, data);
    }
  });

  ptyManager.on("exit", (sessionId: string, exitCode: number) => {
    const window = getMainWindow();
    if (window) {
      window.webContents.send(IPC.EVENT_PTY_EXIT, sessionId, exitCode);
    }
    if (exitCode === 0) {
      // Auto-archive on clean exit to keep sidebar uncluttered
      archiveSession(db, sessionId);
      if (window) {
        window.webContents.send(IPC.EVENT_SESSION_STATUS, sessionId, "archived");
      }
    } else {
      updateSessionStatus(db, sessionId, "error");
      if (window) {
        window.webContents.send(IPC.EVENT_SESSION_STATUS, sessionId, "error");
      }
    }
  });

  ptyManager.on("statusChanged", (sessionId: string, status: string) => {
    updateSessionStatus(db, sessionId, status as "running" | "waiting_for_input");
    const window = getMainWindow();
    if (window) {
      window.webContents.send(IPC.EVENT_SESSION_STATUS, sessionId, status);
    }
  });

  app.on("before-quit", () => {
    ptyManager.killAll();
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

  ipcMain.handle(
    IPC.SESSIONS_CREATE,
    (_event, repoPath: string, agentType: AgentType, branchName?: string, name?: string) => {
      const sessionName = name || `Session ${Date.now()}`;
      let worktreePath = repoPath;
      let resolvedBranch: string | null = null;

      if (branchName) {
        const settings = readSettings(settingsPath);
        worktreePath = createWorktree(repoPath, branchName, settings.worktreeBaseDir);
        resolvedBranch = branchName;
      }

      return createSession(db, { repoPath, worktreePath, branchName: resolvedBranch, agentType, name: sessionName });
    },
  );

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

  ipcMain.handle(IPC.SESSIONS_REORDER, (_event, sessionIds: string[]) => {
    reorderSessions(db, sessionIds);
  });

  // --- Worktrees ---

  ipcMain.handle(IPC.WORKTREES_CLEANUP, (_event, sessionId: string) => {
    const session = getSession(db, sessionId);
    if (session?.branchName) {
      removeWorktree(session.worktreePath, session.branchName, session.repoPath);
      clearSessionWorktree(db, sessionId);
    }
  });

  // --- PTY ---

  ipcMain.handle(
    IPC.PTY_CREATE,
    (_event, sessionId: string, agentType: AgentType, worktreePath: string, cols: number, rows: number) => {
      // Pass the stored Claude session ID for --resume, or null for first launch (--session-id).
      // Legacy sessions stored "used" as a boolean marker — treat those as new sessions.
      const sessionRecord = getSession(db, sessionId);
      const storedSessionId = sessionRecord?.agentSessionId === "used" ? null : (sessionRecord?.agentSessionId ?? null);
      ptyManager.create(sessionId, agentType, worktreePath, cols, rows, storedSessionId);

      // Store the session ID so future launches use --resume
      if (!storedSessionId) {
        updateAgentSessionId(db, sessionId, sessionId);
      }

      updateSessionStatus(db, sessionId, "running");
      const window = getMainWindow();
      if (window) {
        window.webContents.send(IPC.EVENT_SESSION_STATUS, sessionId, "running");
      }
    },
  );

  ipcMain.handle(IPC.PTY_INPUT, (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data);
  });

  ipcMain.handle(IPC.PTY_RESIZE, (_event, sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows);
  });

  ipcMain.handle(IPC.PTY_KILL, (_event, sessionId: string) => {
    ptyManager.kill(sessionId);
  });

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

  ipcMain.handle(IPC.REPOS_GET_BRANCH, (_event, repoPath: string) => {
    try {
      const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: repoPath,
        encoding: "utf8",
        timeout: 3000,
      }).trim();
      return branch || null;
    } catch {
      return null;
    }
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

  ipcMain.handle(IPC.SETTINGS_SELECT_WORKTREE_DIR, async () => {
    const window = getMainWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
      message: "Select a folder for worktrees",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.SETTINGS_GET_SHORTCUTS, () => {
    return getShortcutOverrides(settingsPath);
  });

  ipcMain.handle(IPC.SETTINGS_SAVE_SHORTCUTS, (_event, overrides: Record<string, string>) => {
    saveShortcutOverrides(settingsPath, overrides);
  });

  // --- Fonts ---

  let cachedFonts: FontInfo[] | null = null;

  ipcMain.handle(IPC.FONTS_LIST, async () => {
    if (cachedFonts) return cachedFonts;

    const bundledFonts: FontInfo[] = [
      { familyName: "Geist", monospace: false },
      { familyName: "Geist Mono", monospace: true },
    ];

    try {
      const systemFonts = await getFonts2({ disableQuoting: true });
      const seenNames = new Set(bundledFonts.map((f) => f.familyName));
      const dedupedSystem: FontInfo[] = [];
      for (const font of systemFonts) {
        if (!seenNames.has(font.familyName)) {
          seenNames.add(font.familyName);
          dedupedSystem.push({ familyName: font.familyName, monospace: font.monospace });
        }
      }
      dedupedSystem.sort((a, b) => a.familyName.localeCompare(b.familyName));
      cachedFonts = [...bundledFonts, ...dedupedSystem];
    } catch {
      cachedFonts = bundledFonts;
    }

    return cachedFonts;
  });

  // --- Icons ---

  ipcMain.handle(IPC.SETTINGS_GET_ICON_DATA_URLS, () => {
    const iconsDir = getIconsDir();
    const result: Record<string, string> = {};
    for (let i = 1; i <= 9; i++) {
      const iconId = `icon-0${i}`;
      const iconPath = `${iconsDir}/${iconId}.png`;
      try {
        const data = fs.readFileSync(iconPath);
        result[iconId] = `data:image/png;base64,${data.toString("base64")}`;
      } catch {
        // Skip icons that don't exist
      }
    }
    return result;
  });

  ipcMain.handle(IPC.SETTINGS_SET_APP_ICON, (_event, iconId: string) => {
    writeSettings(settingsPath, { appIcon: iconId });
    applyDockIcon(iconId);
  });

  // --- App ---

  ipcMain.handle(IPC.APP_GET_INFO, () => {
    const { app } = require("electron");
    return { name: app.getName(), version: app.getVersion() };
  });
}
