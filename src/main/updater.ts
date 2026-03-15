import type { ReleaseNoteInfo } from "builder-util-runtime";
import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

// Strip HTML tags and decode entities into plain text
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extract plain text from electron-updater releaseNotes (string, array, or nullish)
export function formatReleaseNotes(notes: string | ReleaseNoteInfo[] | undefined | null): string | undefined {
  if (!notes) return undefined;
  if (typeof notes === "string") return stripHtml(notes);
  if (Array.isArray(notes)) {
    return notes.map((n) => `${n.version}: ${stripHtml(n.note || "")}`).join("\n\n");
  }
  return undefined;
}

let checkInterval: ReturnType<typeof setInterval> | null = null;
let lastCheckTime = 0;

const CHECK_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const INITIAL_DELAY_MS = 30 * 60 * 1000; // 30 minutes
const PERIODIC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function broadcastToAllWindows(channel: string, ...args: unknown[]) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, ...args);
  }
}

async function checkForUpdatesSilently() {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_COOLDOWN_MS) return;

  lastCheckTime = now;
  console.log("[updater] Checking for updates in background...");

  try {
    const result = await autoUpdater.checkForUpdates();
    if (result?.updateInfo && result.updateInfo.version !== app.getVersion()) {
      console.log(`[updater] Update available: ${result.updateInfo.version}`);
      broadcastToAllWindows("updater:update-available", result.updateInfo.version);
    }
  } catch (error) {
    console.error("[updater] Background check failed:", error instanceof Error ? error.message : error);
  }
}

function startPeriodicChecks() {
  if (checkInterval) clearInterval(checkInterval);

  setTimeout(() => {
    checkForUpdatesSilently();
  }, INITIAL_DELAY_MS);

  checkInterval = setInterval(() => {
    checkForUpdatesSilently();
  }, PERIODIC_INTERVAL_MS);

  console.log("[updater] Started periodic checks (every 6h, first in 30min)");
}

function stopPeriodicChecks() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

function registerIpcHandlers() {
  ipcMain.handle("updater:check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result?.updateInfo) {
        return { available: false, error: "No update information available" };
      }
      return {
        available: result.updateInfo.version !== app.getVersion(),
        version: result.updateInfo.version,
        releaseNotes: formatReleaseNotes(result.updateInfo.releaseNotes),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[updater] Check failed:", errorMessage);
      return { available: false, error: errorMessage };
    }
  });

  ipcMain.handle("updater:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[updater] Download failed:", errorMessage);
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle("updater:quitAndInstall", () => {
    autoUpdater.quitAndInstall();
  });
}

function setupEventListeners() {
  autoUpdater.on("update-available", (info) => {
    console.log("[updater] Update available:", info.version);
    broadcastToAllWindows("updater:update-available", info.version);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[updater] Update downloaded:", info.version);
    broadcastToAllWindows("updater:update-downloaded", { version: info.version });
  });

  autoUpdater.on("error", (error) => {
    console.error("[updater] Error:", error);
    broadcastToAllWindows("updater:error", { error: error.message || "Unknown update error" });
  });

  autoUpdater.on("download-progress", (progress) => {
    broadcastToAllWindows("updater:progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });
}

export function setupUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.setFeedURL({
    provider: "github",
    owner: "dakl",
    repo: "codez",
    private: false,
  });

  registerIpcHandlers();
  setupEventListeners();
  startPeriodicChecks();

  app.on("will-quit", () => {
    stopPeriodicChecks();
  });
}
