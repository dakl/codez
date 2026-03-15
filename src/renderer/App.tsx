import { useEffect } from "react";
import { SessionView } from "./components/SessionView/SessionView";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useSessionStore } from "./stores/sessionStore";
import { useThemeStore } from "./stores/themeStore";

export function App() {
  const handleStatusChange = useSessionStore((state) => state.handleStatusChange);
  const loadTheme = useThemeStore((state) => state.loadTheme);

  useGlobalShortcuts();

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // Subscribe to session status changes (driven by sideband detector)
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubStatus = window.electronAPI.onSessionStatusChanged(handleStatusChange);
    return () => {
      unsubStatus();
    };
  }, [handleStatusChange]);

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
