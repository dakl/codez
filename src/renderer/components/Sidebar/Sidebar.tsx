import { useEffect, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useRepoStore } from "../../stores/repoStore";
import { SessionListItem } from "./SessionListItem";
import type { PermissionMode } from "@shared/types";

export function Sidebar() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);
  const loadSessions = useSessionStore((state) => state.loadSessions);

  const repos = useRepoStore((state) => state.repos);
  const selectedRepoPath = useRepoStore((state) => state.selectedRepoPath);
  const selectRepo = useRepoStore((state) => state.selectRepo);
  const loadRepos = useRepoStore((state) => state.loadRepos);
  const addRepoViaDialog = useRepoStore((state) => state.addRepoViaDialog);

  const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");

  // Load repos and settings on mount
  useEffect(() => {
    loadRepos();
    if (window.electronAPI) {
      window.electronAPI.getSettings().then((settings) => {
        if (settings.permissionMode) {
          setPermissionMode(settings.permissionMode);
        }
      });
    }
  }, [loadRepos]);

  // Load sessions when selected repo changes
  useEffect(() => {
    if (selectedRepoPath) {
      loadSessions(selectedRepoPath);
    }
  }, [selectedRepoPath, loadSessions]);

  const handleNewSession = async () => {
    if (!selectedRepoPath) return;
    await createSession(selectedRepoPath, "claude");
  };

  const handleRepoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "__add__") {
      addRepoViaDialog();
    } else {
      selectRepo(value);
    }
  };

  const handlePermissionModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = event.target.value as PermissionMode;
    setPermissionMode(mode);
    if (window.electronAPI) {
      window.electronAPI.saveSettings({ permissionMode: mode });
    }
  };

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
      {/* Draggable title bar region */}
      <div className="h-12 flex items-center px-4 [-webkit-app-region:drag]">
        <span className="text-sm font-medium text-text-muted ml-16">Codez</span>
      </div>

      {/* Repo picker + New session */}
      <div className="px-3 pb-2 space-y-2">
        <select
          value={selectedRepoPath ?? ""}
          onChange={handleRepoChange}
          className="w-full rounded-md bg-input border border-border px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent [-webkit-app-region:no-drag]"
        >
          {repos.length === 0 && <option value="">No repos</option>}
          {repos.map((repo) => (
            <option key={repo.path} value={repo.path}>
              {repo.name}
            </option>
          ))}
          <option value="__add__">+ Add repo…</option>
        </select>

        <button
          onClick={handleNewSession}
          disabled={!selectedRepoPath}
          type="button"
          className="w-full rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-hover disabled:opacity-30 transition-colors [-webkit-app-region:no-drag]"
        >
          New Session ⌘N
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-text-muted">
              {selectedRepoPath ? "No sessions yet" : "Select a repo to start"}
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => setActiveSession(session.id)}
            />
          ))
        )}
      </div>

      {/* Permission mode selector */}
      <div className="px-3 py-2 border-t border-border">
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Permissions
        </label>
        <select
          value={permissionMode}
          onChange={handlePermissionModeChange}
          className="w-full rounded-md bg-input border border-border px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent [-webkit-app-region:no-drag]"
        >
          <option value="default">Default</option>
          <option value="acceptEdits">Accept Edits</option>
          <option value="bypassPermissions">Bypass All</option>
          <option value="plan">Plan Only</option>
        </select>
      </div>
    </aside>
  );
}
