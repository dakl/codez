import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getShortcutOverrides, readSettings, saveShortcutOverrides, writeSettings } from "./settings";

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

describe("worktreeBaseDir round-trip", () => {
  it("persists and reads worktreeBaseDir", () => {
    writeSettings(settingsPath, { worktreeBaseDir: "/tmp/my-worktrees" });
    const settings = readSettings(settingsPath);
    expect(settings.worktreeBaseDir).toBe("/tmp/my-worktrees");
  });

  it("merges worktreeBaseDir without clobbering other settings", () => {
    writeSettings(settingsPath, { voiceEnabled: true, theme: "midnight" });
    writeSettings(settingsPath, { worktreeBaseDir: "/tmp/trees" });
    const settings = readSettings(settingsPath);
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.theme).toBe("midnight");
    expect(settings.worktreeBaseDir).toBe("/tmp/trees");
  });
});

describe("font settings round-trip", () => {
  it("persists and reads fontSans and fontMono", () => {
    writeSettings(settingsPath, { fontSans: "Inter", fontMono: "JetBrains Mono" });
    const settings = readSettings(settingsPath);
    expect(settings.fontSans).toBe("Inter");
    expect(settings.fontMono).toBe("JetBrains Mono");
  });

  it("merges font settings without clobbering other settings", () => {
    writeSettings(settingsPath, { voiceEnabled: true, theme: "midnight" });
    writeSettings(settingsPath, { fontSans: "Inter" });
    const settings = readSettings(settingsPath);
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.theme).toBe("midnight");
    expect(settings.fontSans).toBe("Inter");
  });

  it("allows updating fontMono independently of fontSans", () => {
    writeSettings(settingsPath, { fontSans: "Inter", fontMono: "Fira Code" });
    writeSettings(settingsPath, { fontMono: "JetBrains Mono" });
    const settings = readSettings(settingsPath);
    expect(settings.fontSans).toBe("Inter");
    expect(settings.fontMono).toBe("JetBrains Mono");
  });
});

describe("font size and line height round-trip", () => {
  it("persists and reads fontSizeMono and terminalLineHeight", () => {
    writeSettings(settingsPath, { fontSizeMono: 14, terminalLineHeight: 1.6 });
    const settings = readSettings(settingsPath);
    expect(settings.fontSizeMono).toBe(14);
    expect(settings.terminalLineHeight).toBe(1.6);
  });

  it("merges font size settings without clobbering other settings", () => {
    writeSettings(settingsPath, { voiceEnabled: true, fontSans: "Inter" });
    writeSettings(settingsPath, { fontSizeMono: 16 });
    const settings = readSettings(settingsPath);
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.fontSans).toBe("Inter");
    expect(settings.fontSizeMono).toBe(16);
  });
});

describe("agentConfigs round-trip", () => {
  it("persists and reads defaultPermissions for claude", () => {
    const allowedTools = ["Edit", "Read", "Bash(git *)"];
    writeSettings(settingsPath, {
      agentConfigs: { claude: { defaultPermissions: allowedTools } },
    });
    const settings = readSettings(settingsPath);
    expect(settings.agentConfigs?.claude?.defaultPermissions).toEqual(allowedTools);
  });

  it("merges agentConfigs without clobbering other settings", () => {
    writeSettings(settingsPath, { voiceEnabled: true, theme: "midnight" });
    writeSettings(settingsPath, {
      agentConfigs: { claude: { defaultPermissions: ["Bash(npm *)"] } },
    });
    const settings = readSettings(settingsPath);
    expect(settings.voiceEnabled).toBe(true);
    expect(settings.theme).toBe("midnight");
    expect(settings.agentConfigs?.claude?.defaultPermissions).toEqual(["Bash(npm *)"]);
  });
});
