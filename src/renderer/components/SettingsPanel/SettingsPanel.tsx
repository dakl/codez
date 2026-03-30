import type { FontInfo } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { useFontStore } from "../../stores/fontStore";
import { useThemeStore } from "../../stores/themeStore";
import { themes } from "../../themes";
import { Tooltip } from "../Tooltip";
import { FontSelector } from "./FontSelector";
import { ThemeSwatch } from "./ThemeSwatch";

const ICON_IDS = Array.from({ length: 9 }, (_, i) => `icon-0${i + 1}`);

type UpdateState = "idle" | "checking" | "available" | "downloading" | "downloaded" | "error" | "up-to-date";

interface UpdateInfo {
  version?: string;
  releaseNotes?: string;
  error?: string;
  downloadPercent?: number;
}

export function SettingsPanel() {
  const settingsOpen = useThemeStore((state) => state.settingsOpen);
  const closeSettings = useThemeStore((state) => state.closeSettings);
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const setTheme = useThemeStore((state) => state.setTheme);

  const fontSans = useFontStore((state) => state.fontSans);
  const fontMono = useFontStore((state) => state.fontMono);
  const fontSizeMono = useFontStore((state) => state.fontSizeMono);
  const terminalLineHeight = useFontStore((state) => state.terminalLineHeight);
  const setFontSans = useFontStore((state) => state.setFontSans);
  const setFontMono = useFontStore((state) => state.setFontMono);
  const setFontSizeMono = useFontStore((state) => state.setFontSizeMono);
  const setTerminalLineHeight = useFontStore((state) => state.setTerminalLineHeight);

  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [activeIcon, setActiveIcon] = useState("icon-01");
  const [iconDataUrls, setIconDataUrls] = useState<Record<string, string>>({});
  const [appVersion, setAppVersion] = useState("");
  const [worktreeBaseDir, setWorktreeBaseDir] = useState<string | undefined>();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({});

  // Load icon data and app version on open
  useEffect(() => {
    if (!settingsOpen || !window.electronAPI) return;
    window.electronAPI.getSettings().then((settings) => {
      setActiveIcon(settings.appIcon ?? "icon-01");
      setWorktreeBaseDir(settings.worktreeBaseDir);
      setNotificationsEnabled(settings.notificationsEnabled !== false);
    });
    window.electronAPI.getIconDataUrls().then(setIconDataUrls);
    window.electronAPI.listFonts().then(setFonts);
    window.electronAPI.getAppInfo().then((info) => setAppVersion(info.version));
  }, [settingsOpen]);

  // Listen for update events from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanups = [
      window.electronAPI.onUpdateAvailable((version) => {
        setUpdateState("available");
        setUpdateInfo((prev) => ({ ...prev, version }));
      }),
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateState("downloaded");
        setUpdateInfo((prev) => ({ ...prev, version: info.version }));
      }),
      window.electronAPI.onUpdateProgress((progress) => {
        setUpdateState("downloading");
        setUpdateInfo((prev) => ({ ...prev, downloadPercent: progress.percent }));
      }),
      window.electronAPI.onUpdateError((info) => {
        setUpdateState("error");
        setUpdateInfo((prev) => ({ ...prev, error: info.error }));
      }),
    ];

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  const handleIconSelect = useCallback((iconId: string) => {
    if (!window.electronAPI) return;
    setActiveIcon(iconId);
    window.electronAPI.setAppIcon(iconId);
  }, []);

  const handleCheckForUpdate = useCallback(async () => {
    if (!window.electronAPI) return;
    setUpdateState("checking");
    setUpdateInfo({});
    const result = await window.electronAPI.checkForUpdate();
    if (result.error) {
      setUpdateState("error");
      setUpdateInfo({ error: result.error });
    } else if (result.available) {
      setUpdateState("available");
      setUpdateInfo({ version: result.version, releaseNotes: result.releaseNotes });
    } else {
      setUpdateState("up-to-date");
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!window.electronAPI) return;
    setUpdateState("downloading");
    setUpdateInfo((prev) => ({ ...prev, downloadPercent: 0 }));
    const result = await window.electronAPI.downloadUpdate();
    if (result.error) {
      setUpdateState("error");
      setUpdateInfo((prev) => ({ ...prev, error: result.error }));
    }
  }, []);

  const handleQuitAndInstall = useCallback(() => {
    if (!window.electronAPI) return;
    window.electronAPI.quitAndInstall();
  }, []);

  const handleSelectWorktreeDir = useCallback(async () => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.selectWorktreeDir();
    if (dir) {
      setWorktreeBaseDir(dir);
      await window.electronAPI.saveSettings({ worktreeBaseDir: dir });
    }
  }, []);

  const handleToggleNotifications = useCallback(async () => {
    if (!window.electronAPI) return;
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    await window.electronAPI.saveSettings({ notificationsEnabled: next });
  }, [notificationsEnabled]);

  const handleClearWorktreeDir = useCallback(async () => {
    if (!window.electronAPI) return;
    setWorktreeBaseDir(undefined);
    await window.electronAPI.saveSettings({ worktreeBaseDir: undefined });
  }, []);

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

        {/* Worktree Location section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Worktree Location</h3>
          <div className="rounded-lg bg-surface border border-border-subtle p-4">
            <p className="text-[11px] text-text-muted mb-3">
              {worktreeBaseDir
                ? "Worktrees are created in the folder below."
                : "Worktrees are created next to each repo by default."}
            </p>
            {worktreeBaseDir && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-text-primary font-mono truncate flex-1">{worktreeBaseDir}</span>
                <button
                  type="button"
                  onClick={handleClearWorktreeDir}
                  className="text-[10px] text-text-muted hover:text-red-400 transition-colors cursor-pointer shrink-0"
                >
                  Reset
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleSelectWorktreeDir}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25 transition-colors cursor-pointer"
            >
              {worktreeBaseDir ? "Change Folder..." : "Choose Folder..."}
            </button>
          </div>
        </div>

        {/* Notifications section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Notifications</h3>
          <div className="rounded-lg bg-surface border border-border-subtle p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                Show macOS notifications when a session is waiting for input
              </span>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  notificationsEnabled
                    ? "bg-accent/15 text-accent hover:bg-accent/25"
                    : "bg-white/5 text-text-muted hover:bg-white/10"
                }`}
              >
                {notificationsEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        </div>

        {/* Fonts section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Fonts</h3>
          <div className="rounded-lg bg-surface border border-border-subtle p-4 space-y-3">
            <FontSelector label="UI Font" value={fontSans} fonts={fonts} onChange={setFontSans} />
            <FontSelector label="Code Font" value={fontMono} fonts={fonts} onChange={setFontMono} />
            <div>
              <label className="flex items-center justify-between text-xs text-text-secondary mb-1">
                <span>Code Font Size</span>
                <span className="text-text-muted">{fontSizeMono}px</span>
              </label>
              <input
                type="range"
                min={10}
                max={24}
                step={1}
                value={fontSizeMono}
                onChange={(event) => setFontSizeMono(Number(event.target.value))}
                className="w-full accent-accent"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-xs text-text-secondary mb-1">
                <span>Line Height</span>
                <span className="text-text-muted">{terminalLineHeight.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={1.0}
                max={2.0}
                step={0.1}
                value={terminalLineHeight}
                onChange={(event) => setTerminalLineHeight(Number(event.target.value))}
                className="w-full accent-accent"
              />
            </div>
          </div>
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

        {/* App Icon section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary mb-3">App Icon</h3>
          <div className="grid grid-cols-3 gap-2">
            {ICON_IDS.map((iconId) => (
              <button
                key={iconId}
                type="button"
                onClick={() => handleIconSelect(iconId)}
                className={`flex items-center justify-center p-2 rounded-lg transition-all cursor-pointer
                  ${
                    activeIcon === iconId
                      ? "bg-accent/20 ring-2 ring-accent"
                      : "bg-surface hover:bg-surface/80 border border-border-subtle"
                  }`}
              >
                {iconDataUrls[iconId] ? (
                  <img src={iconDataUrls[iconId]} alt={iconId} className="w-12 h-12 rounded-lg" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-surface animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Updates section */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Updates</h3>
          <div className="rounded-lg bg-surface border border-border-subtle p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Current version: {appVersion}</span>
              {updateState === "idle" || updateState === "up-to-date" || updateState === "error" ? (
                <button
                  type="button"
                  onClick={handleCheckForUpdate}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25 transition-colors cursor-pointer"
                >
                  Check for Updates
                </button>
              ) : null}
            </div>

            {updateState === "checking" && <p className="text-xs text-text-muted">Checking for updates...</p>}

            {updateState === "up-to-date" && <p className="text-xs text-green-400">You're on the latest version.</p>}

            {updateState === "error" && updateInfo.error && <p className="text-xs text-red-400">{updateInfo.error}</p>}

            {updateState === "available" && (
              <div className="space-y-2">
                <p className="text-xs text-text-primary">Version {updateInfo.version} is available.</p>
                {updateInfo.releaseNotes && (
                  <p className="text-xs text-text-muted whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {updateInfo.releaseNotes}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  Download Update
                </button>
              </div>
            )}

            {updateState === "downloading" && (
              <div className="space-y-2">
                <p className="text-xs text-text-muted">Downloading... {Math.round(updateInfo.downloadPercent ?? 0)}%</p>
                <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${updateInfo.downloadPercent ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {updateState === "downloaded" && (
              <div className="space-y-2">
                <p className="text-xs text-green-400">Version {updateInfo.version} is ready to install.</p>
                <button
                  type="button"
                  onClick={handleQuitAndInstall}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  Restart to Update
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
