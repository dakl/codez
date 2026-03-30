import { useEffect } from "react";
import { SessionView } from "./components/SessionView/SessionView";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useFontStore } from "./stores/fontStore";
import { useSessionStore } from "./stores/sessionStore";
import { useThemeStore } from "./stores/themeStore";

export function App() {
  const handleStatusChange = useSessionStore((state) => state.handleStatusChange);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const loadTheme = useThemeStore((state) => state.loadTheme);
  const loadFonts = useFontStore((state) => state.loadFonts);
  const toggleSettings = useThemeStore((state) => state.toggleSettings);

  useGlobalShortcuts();

  useEffect(() => {
    loadTheme();
    loadFonts();
  }, [loadTheme, loadFonts]);

  // Subscribe to session status changes (driven by sideband detector)
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubStatus = window.electronAPI.onSessionStatusChanged(handleStatusChange);
    return () => {
      unsubStatus();
    };
  }, [handleStatusChange]);

  // Force layout recalculation when app becomes visible again.
  // macOS can report stale viewport dimensions when restoring a window
  // (e.g. switching spaces, waking from sleep), which leaves the bottom
  // half of the app blank.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        window.dispatchEvent(new Event("resize"));
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Navigate to session when notification is clicked
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onNavigateToSession(setActiveSession);
  }, [setActiveSession]);

  // Subscribe to menu → Settings
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onMenuSettings(toggleSettings);
  }, [toggleSettings]);

  return (
    <div className="flex h-screen select-none bg-base">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 bg-base">
        {/* Draggable title bar region */}
        <div className="h-12 [-webkit-app-region:drag]" />
        <SessionView />
      </main>
      <SettingsPanel />
    </div>
  );
}
