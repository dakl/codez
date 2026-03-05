import { useEffect, useCallback } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { themes } from "../../themes";
import { ThemeSwatch } from "./ThemeSwatch";

export function SettingsPanel() {
  const settingsOpen = useThemeStore((state) => state.settingsOpen);
  const closeSettings = useThemeStore((state) => state.closeSettings);
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const setTheme = useThemeStore((state) => state.setTheme);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={closeSettings}
    >
      <div
        className="w-full max-w-[480px] rounded-xl bg-elevated p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            type="button"
            onClick={closeSettings}
            title="Close settings (Esc)"
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <title>Close</title>
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Theme section */}
        <div>
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
      </div>
    </div>
  );
}
