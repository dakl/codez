import path from "node:path";
import { app } from "electron";

export function getDataDir(): string {
  return path.join(app.getPath("userData"));
}

export function getDbPath(): string {
  return path.join(getDataDir(), "codez.db");
}

export function getSettingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}
