import { useCallback, useEffect, useState } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { themes } from "../../themes";
import { Tooltip } from "../Tooltip";
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

  const [activeIcon, setActiveIcon] = useState("icon-01");
  const [iconDataUrls, setIconDataUrls] = useState<Record<string, string>>({});
  const [appVersion, setAppVersion] = useState("");

  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({});

  // Load icon data and app version on open
  useEffect(() => {
    if (!settingsOpen || !window.electronAPI) return;
    window.electronAPI.getSettings().then((settings) => {
      setActiveIcon(settings.appIcon ?? "icon-01");
    });
    window.electronAPI.getIconDataUrls().then(setIconDataUrls);
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
