import type { AgentType } from "@shared/agent-types";
import { useEffect, useState } from "react";
import { MistralApiKeyDialog } from "./components/MistralApiKeyDialog";
import { NewSessionDialog } from "./components/NewSessionDialog";
import { SessionView } from "./components/SessionView/SessionView";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useRepoStore } from "./stores/repoStore";
import { useSessionStore } from "./stores/sessionStore";
import { useThemeStore } from "./stores/themeStore";

export function App() {
  const handleAgentEvent = useSessionStore((state) => state.handleAgentEvent);
  const handleStatusChange = useSessionStore((state) => state.handleStatusChange);
  const createSession = useSessionStore((state) => state.createSession);
  const selectedRepoPath = useRepoStore((state) => state.selectedRepoPath);
  const loadTheme = useThemeStore((state) => state.loadTheme);
  const mistralApiKeyDialogOpen = useThemeStore((state) => state.mistralApiKeyDialogOpen);
  const openMistralApiKeyDialog = useThemeStore((state) => state.openMistralApiKeyDialog);
  const closeMistralApiKeyDialog = useThemeStore((state) => state.closeMistralApiKeyDialog);
  const newSessionDialogOpen = useThemeStore((state) => state.newSessionDialogOpen);
  const closeNewSessionDialog = useThemeStore((state) => state.closeNewSessionDialog);
  const openSettings = useThemeStore((state) => state.toggleSettings);

  const [defaultAgent, setDefaultAgent] = useState<AgentType>("claude");

  // Load default agent from settings
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getSettings().then((settings) => {
      const agent = (settings.agentConfigs?.defaultAgent as AgentType) ?? "claude";
      setDefaultAgent(agent);
    });
  }, []);

  const handleCreateSession = async (options: { agentType: AgentType; useWorktree: boolean }) => {
    if (!selectedRepoPath) return;
    closeNewSessionDialog();

    // Check Mistral API key before creating
    if (options.agentType === "mistral" && window.electronAPI) {
      const apiKey = await window.electronAPI.getMistralApiKey();
      if (!apiKey) {
        openMistralApiKeyDialog();
        return;
      }
    }

    // Persist agent choice as new default
    if (window.electronAPI) {
      window.electronAPI.saveSettings({ agentConfigs: { defaultAgent: options.agentType } });
    }
    setDefaultAgent(options.agentType);

    await createSession(selectedRepoPath, options.agentType);
  };

  useGlobalShortcuts();

  // Load persisted theme on mount
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // Subscribe to main process events
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubAgent = window.electronAPI.onAgentEvent(handleAgentEvent);
    const unsubStatus = window.electronAPI.onSessionStatusChanged(handleStatusChange);
    return () => {
      unsubAgent();
      unsubStatus();
    };
  }, [handleAgentEvent, handleStatusChange]);

  return (
    <div className="flex h-screen select-none bg-base">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 bg-base">
        {/* Draggable title bar region */}
        <div className="h-12 [-webkit-app-region:drag]" />
        <SessionView />
      </main>
      <SettingsPanel />
      {newSessionDialogOpen && (
        <NewSessionDialog
          defaultAgent={defaultAgent}
          onConfirm={handleCreateSession}
          onDismiss={closeNewSessionDialog}
        />
      )}
      {mistralApiKeyDialogOpen && (
        <MistralApiKeyDialog
          onConfigure={() => {
            closeMistralApiKeyDialog();
            openSettings();
          }}
          onDismiss={closeMistralApiKeyDialog}
        />
      )}
    </div>
  );
}
