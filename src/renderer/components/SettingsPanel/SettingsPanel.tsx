import type { PermissionMode } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { Tooltip } from "../Tooltip";
import { useThemeStore } from "../../stores/themeStore";
import { themes } from "../../themes";
import { ThemeSwatch } from "./ThemeSwatch";

interface ToolPreset {
  value: string;
  label: string;
  description: string;
}

const TOOL_PRESETS: ToolPreset[] = [
  { value: "Edit", label: "Edit", description: "File edits" },
  { value: "Write", label: "Write", description: "New files" },
  { value: "Bash(git *)", label: "Git", description: "git commands" },
  { value: "Bash(npm *)", label: "npm", description: "npm scripts" },
];

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "Prompt for each tool use" },
  { value: "acceptEdits", label: "Accept Edits", description: "Auto-approve file edits" },
  { value: "plan", label: "Plan", description: "Read-only until plan is approved" },
  { value: "bypassPermissions", label: "Bypass All", description: "Skip all permission prompts" },
];

export function SettingsPanel() {
  const settingsOpen = useThemeStore((state) => state.settingsOpen);
  const closeSettings = useThemeStore((state) => state.closeSettings);
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const setTheme = useThemeStore((state) => state.setTheme);

  const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [customRuleInput, setCustomRuleInput] = useState("");

  // Load settings on open
  useEffect(() => {
    if (!settingsOpen || !window.electronAPI) return;
    window.electronAPI.getSettings().then((settings) => {
      setPermissionMode(settings.permissionMode ?? "default");
      setAllowedTools(settings.agentConfigs?.claude?.defaultPermissions ?? []);
    });
  }, [settingsOpen]);

  const savePermissions = useCallback((mode: PermissionMode, tools: string[]) => {
    if (!window.electronAPI) return;
    window.electronAPI.saveSettings({
      permissionMode: mode,
      agentConfigs: { claude: { defaultPermissions: tools } },
    });
  }, []);

  const handlePermissionModeChange = useCallback(
    (mode: PermissionMode) => {
      setPermissionMode(mode);
      savePermissions(mode, allowedTools);
    },
    [allowedTools, savePermissions],
  );

  const togglePreset = useCallback(
    (toolValue: string) => {
      const updated = allowedTools.includes(toolValue)
        ? allowedTools.filter((tool) => tool !== toolValue)
        : [...allowedTools, toolValue];
      setAllowedTools(updated);
      savePermissions(permissionMode, updated);
    },
    [allowedTools, permissionMode, savePermissions],
  );

  const addCustomRule = useCallback(() => {
    const rule = customRuleInput.trim();
    if (!rule || allowedTools.includes(rule)) return;
    const updated = [...allowedTools, rule];
    setAllowedTools(updated);
    setCustomRuleInput("");
    savePermissions(permissionMode, updated);
  }, [customRuleInput, allowedTools, permissionMode, savePermissions]);

  const removeRule = useCallback(
    (rule: string) => {
      const updated = allowedTools.filter((tool) => tool !== rule);
      setAllowedTools(updated);
      savePermissions(permissionMode, updated);
    },
    [allowedTools, permissionMode, savePermissions],
  );

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
      }
    },
    [closeSettings],
  );

  useEffect(() => {
    if (!settingsOpen) return;
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [settingsOpen, handleEscape]);

  if (!settingsOpen) return null;

  // Custom rules = anything in allowedTools that isn't a preset value
  const presetValues = new Set(TOOL_PRESETS.map((preset) => preset.value));
  const customRules = allowedTools.filter((tool) => !presetValues.has(tool));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeSettings}>
      <div
        className="w-full max-w-[480px] max-h-[85vh] overflow-y-auto rounded-xl bg-elevated p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <Tooltip label="Close (Esc)" position="below">
            <button
              type="button"
              onClick={closeSettings}
              className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <title>Close</title>
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Theme section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Theme</h3>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((theme) => (
              <ThemeSwatch
                key={theme.id}
                theme={theme}
                isActive={theme.id === activeThemeId}
                onClick={() => setTheme(theme.id)}
              />
            ))}
          </div>
        </div>

        {/* Permissions section */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Permissions</h3>

          {/* Permission mode */}
          <label className="block mb-3">
            <span className="text-xs text-text-muted">Permission mode</span>
            <select
              value={permissionMode}
              onChange={(event) => handlePermissionModeChange(event.target.value as PermissionMode)}
              className="mt-1 block w-full rounded-md bg-surface border border-border-subtle px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {PERMISSION_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label} — {mode.description}
                </option>
              ))}
            </select>
          </label>

          {/* Auto-approved tools */}
          <div className="mt-4">
            <span className="text-xs text-text-muted">Auto-approved tools</span>
            <p className="text-xs text-text-muted/60 mt-0.5 mb-2">These tools run without asking for permission.</p>

            {/* Preset chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TOOL_PRESETS.map((preset) => {
                const isActive = allowedTools.includes(preset.value);
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => togglePreset(preset.value)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer
                      ${
                        isActive
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-surface text-text-muted border border-border-subtle hover:border-text-muted"
                      }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom rules */}
            {customRules.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {customRules.map((rule) => (
                  <span
                    key={rule}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-surface text-text-secondary border border-border-subtle"
                  >
                    <code>{rule}</code>
                    <button
                      type="button"
                      onClick={() => removeRule(rule)}
                      className="text-text-muted hover:text-text-primary ml-0.5 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add custom rule */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customRuleInput}
                onChange={(event) => setCustomRuleInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomRule();
                  }
                }}
                placeholder="e.g. Bash(cargo *)"
                className="flex-1 rounded-md bg-surface border border-border-subtle px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={addCustomRule}
                disabled={!customRuleInput.trim()}
                className="px-3 py-1.5 rounded-md text-xs bg-surface border border-border-subtle text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-default cursor-pointer transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
