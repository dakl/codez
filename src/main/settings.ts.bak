import fs from "node:fs";
import path from "node:path";
import type { AppSettings } from "../shared/types.js";

export function readSettings(settingsPath: string): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    return JSON.parse(raw) as AppSettings;
  } catch {
    return {};
  }
}

export function writeSettings(settingsPath: string, updates: Partial<AppSettings>): void {
  const dir = path.dirname(settingsPath);
  fs.mkdirSync(dir, { recursive: true });

  const existing = readSettings(settingsPath);
  const merged = { ...existing, ...updates };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
}

export function getShortcutOverrides(settingsPath: string): Record<string, string> {
  const settings = readSettings(settingsPath);
  return settings.shortcuts ?? {};
}

export function saveShortcutOverrides(settingsPath: string, overrides: Record<string, string>): void {
  writeSettings(settingsPath, { shortcuts: overrides });
}
