import path from "node:path";
import { app } from "electron";

export function getDataDir(): string {
  if (process.env.E2E_DATA_DIR) {
    return process.env.E2E_DATA_DIR;
  }
  return path.join(app.getPath("userData"));
}

export function getDbPath(): string {
  return path.join(getDataDir(), "codez.db");
}

export function getSettingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}

export function getHookSettingsPath(sessionId: string): string {
  return path.join(getDataDir(), "hook-settings", `${sessionId}.json`);
}

export function getHookSignalPath(sessionId: string): string {
  return path.join(getDataDir(), "hook-signals", sessionId);
}
