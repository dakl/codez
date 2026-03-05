import { useEffect } from "react";
import { useThemeStore } from "../stores/themeStore";

export function isSettingsShortcut(event: KeyboardEvent): boolean {
  return event.key === "," && event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;
}

export function useGlobalShortcuts(): void {
  const toggleSettings = useThemeStore((state) => state.toggleSettings);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isSettingsShortcut(event)) {
        event.preventDefault();
        toggleSettings();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSettings]);
}
