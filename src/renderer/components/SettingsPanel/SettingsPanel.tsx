import { useCallback, useEffect, useState } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { themes } from "../../themes";
import { Tooltip } from "../Tooltip";
import { ThemeSwatch } from "./ThemeSwatch";

const ICON_IDS = Array.from({ length: 9 }, (_, i) => `icon-0${i + 1}`);

export function SettingsPanel() {
  const settingsOpen = useThemeStore((state) => state.settingsOpen);
  const closeSettings = useThemeStore((state) => state.closeSettings);
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const setTheme = useThemeStore((state) => state.setTheme);

  const [activeIcon, setActiveIcon] = useState("icon-01");
  const [iconDataUrls, setIconDataUrls] = useState<Record<string, string>>({});

  // Load icon data on open
  useEffect(() => {
    if (!settingsOpen || !window.electronAPI) return;
    window.electronAPI.getSettings().then((settings) => {
      setActiveIcon(settings.appIcon ?? "icon-01");
    });
    window.electronAPI.getIconDataUrls().then(setIconDataUrls);
  }, [settingsOpen]);

  const handleIconSelect = useCallback((iconId: string) => {
    if (!window.electronAPI) return;
    setActiveIcon(iconId);
    window.electronAPI.setAppIcon(iconId);
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
        <div>
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
      </div>
    </div>
  );
}
