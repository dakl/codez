import { useEffect } from "react";
import { useRepoStore } from "../stores/repoStore";
import { useSessionStore } from "../stores/sessionStore";
import { useThemeStore } from "../stores/themeStore";

export function isSettingsShortcut(event: KeyboardEvent): boolean {
  return event.key === "," && event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;
}

export function isNewSessionShortcut(event: KeyboardEvent): boolean {
  return event.key === "n" && event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;
}

export function useGlobalShortcuts(): void {
  const toggleSettings = useThemeStore((state) => state.toggleSettings);
  const createSession = useSessionStore((state) => state.createSession);
  const addRepoViaDialog = useRepoStore((state) => state.addRepoViaDialog);

  useEffect(() => {
    async function handleKeyDown(event: KeyboardEvent) {
      if (isSettingsShortcut(event)) {
        event.preventDefault();
        toggleSettings();
      }

      if (isNewSessionShortcut(event)) {
        event.preventDefault();
        // Always open folder picker so user chooses where to run
        const repo = await addRepoViaDialog();
        if (repo) {
          createSession(repo.path, "claude");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSettings, createSession, addRepoViaDialog]);
}
