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

export function isSidebarToggleShortcut(event: KeyboardEvent): boolean {
  return event.key === "\\" && event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;
}

export function useGlobalShortcuts(): void {
  const toggleSettings = useThemeStore((state) => state.toggleSettings);
  const toggleSidebar = useThemeStore((state) => state.toggleSidebar);
  const setPendingNewSessionRepo = useSessionStore((state) => state.setPendingNewSessionRepo);
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

      if (isSidebarToggleShortcut(event)) {
        event.preventDefault();
        toggleSidebar();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSettings, toggleSidebar, setPendingNewSessionRepo, addRepoViaDialog]);
}
