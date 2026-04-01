import "./logger.js";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { app, BrowserWindow, Menu } from "electron";
import { createDatabase } from "./db/connection.js";
import { resetStaleSessions } from "./db/sessions.js";
import { applyDockIcon } from "./dock.js";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { getDbPath, getSettingsPath } from "./paths.js";
import { readSettings } from "./settings.js";
import { setupUpdater } from "./updater.js";

// Packaged macOS apps don't inherit the user's shell PATH.
// Resolve it once at startup so spawned CLI tools (claude, etc.) are found.
function fixPath(): void {
  if (process.platform !== "darwin" || !app.isPackaged) return;
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const shellPath = execFileSync(shell, ["-ilc", "echo $PATH"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (shellPath) {
      process.env.PATH = shellPath;
    }
  } catch {
    // Fall through with default PATH if shell fails
  }
}

fixPath();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    vibrancy: "sidebar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged && process.env.E2E_TEST !== "true";
  if (isDev) {
    mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "..", "renderer", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const db = createDatabase(getDbPath());

  // PTYs don't survive app restarts — reset running/waiting sessions to idle
  const staleCount = resetStaleSessions(db);
  if (staleCount > 0) {
    console.log(`[startup] Reset ${staleCount} stale session(s) to idle`);
  }

  const settingsPath = getSettingsPath();

  registerIpcHandlers({
    db,
    settingsPath,
    getMainWindow: () => mainWindow,
  });

  // Apply saved dock icon (defaults to icon-01)
  const settings = readSettings(settingsPath);
  applyDockIcon(settings.appIcon);

  createWindow();

  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings...",
          accelerator: "Cmd+,",
          click: () => mainWindow?.webContents.send("menu:settings"),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
  ]);
  Menu.setApplicationMenu(menu);

  setupUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
