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

export function isMarkUnreadShortcut(event: KeyboardEvent): boolean {
  return event.key === "u" && event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;
}

export function useGlobalShortcuts(): void {
  const toggleSettings = useThemeStore((state) => state.toggleSettings);
  const setPendingNewSessionRepo = useSessionStore((state) => state.setPendingNewSessionRepo);
  const markUnread = useSessionStore((state) => state.markUnread);
  const addRepoViaDialog = useRepoStore((state) => state.addRepoViaDialog);

  useEffect(() => {
    async function handleKeyDown(event: KeyboardEvent) {
      if (isSettingsShortcut(event)) {
        event.preventDefault();
        toggleSettings();
      }

      if (isNewSessionShortcut(event)) {
        event.preventDefault();
        const repo = await addRepoViaDialog();
        if (repo) {
          setPendingNewSessionRepo(repo);
        }
      }

      if (isMarkUnreadShortcut(event)) {
        event.preventDefault();
        const activeSessionId = useSessionStore.getState().activeSessionId;
        if (activeSessionId) {
          markUnread(activeSessionId);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSettings, setPendingNewSessionRepo, markUnread, addRepoViaDialog]);
}
