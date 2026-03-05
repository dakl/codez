import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

import { readSettings, writeSettings, getShortcutOverrides, saveShortcutOverrides } from "./settings";

let tempDir: string;
let settingsPath: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codez-test-"));
  settingsPath = path.join(tempDir, "settings.json");
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("readSettings", () => {
  it("returns empty object when settings file does not exist", () => {
    const settings = readSettings(settingsPath);
    expect(settings).toEqual({});
  });

  it("reads and parses existing settings file", () => {
    fs.writeFileSync(settingsPath, JSON.stringify({ voiceEnabled: true, whisperModel: "base.en" }));
    const settings = readSettings(settingsPath);
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.whisperModel).toBe("base.en");
  });

  it("returns empty object when settings file contains invalid JSON", () => {
    fs.writeFileSync(settingsPath, "not json{{{");
    const settings = readSettings(settingsPath);
    expect(settings).toEqual({});
  });
});

describe("writeSettings", () => {
  it("writes settings to file", () => {
    writeSettings(settingsPath, { voiceEnabled: true });
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.voiceEnabled).toBe(true);
  });

  it("merges with existing settings", () => {
    writeSettings(settingsPath, { voiceEnabled: true, whisperModel: "base.en" });
    writeSettings(settingsPath, { whisperModel: "small.en" });
    const settings = readSettings(settingsPath);
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.whisperModel).toBe("small.en");
  });

  it("creates parent directory if it does not exist", () => {
    const nestedPath = path.join(tempDir, "nested", "dir", "settings.json");
    writeSettings(nestedPath, { voiceEnabled: true });
    const settings = readSettings(nestedPath);
    expect(settings.voiceEnabled).toBe(true);
  });
});

describe("getShortcutOverrides", () => {
  it("returns empty object when no overrides are saved", () => {
    const overrides = getShortcutOverrides(settingsPath);
    expect(overrides).toEqual({});
  });

  it("returns saved shortcut overrides", () => {
    writeSettings(settingsPath, { shortcuts: { toggleSidebar: "Meta+Shift+b" } });
    const overrides = getShortcutOverrides(settingsPath);
    expect(overrides).toEqual({ toggleSidebar: "Meta+Shift+b" });
  });
});

describe("saveShortcutOverrides", () => {
  it("saves shortcut overrides without clobbering other settings", () => {
    writeSettings(settingsPath, { voiceEnabled: true });
    saveShortcutOverrides(settingsPath, { toggleSidebar: "Meta+Shift+b" });
    const settings = readSettings(settingsPath);
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.shortcuts).toEqual({ toggleSidebar: "Meta+Shift+b" });
  });
});
