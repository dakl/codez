import { execFileSync } from "node:child_process";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import { createDatabase } from "./db/connection.js";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { getDbPath, getSettingsPath } from "./paths.js";

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

  const isDev = !app.isPackaged;
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
  registerIpcHandlers({
    db,
    settingsPath: getSettingsPath(),
    getMainWindow: () => mainWindow,
  });

  createWindow();

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
