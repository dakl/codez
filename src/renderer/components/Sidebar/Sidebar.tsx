import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionShortcuts } from "../../hooks/useChordShortcuts";
import { useRepoStore } from "../../stores/repoStore";
import { useSessionStore } from "../../stores/sessionStore";
import { SessionListItem } from "./SessionListItem";

export function Sidebar() {
  const sessions = useSessionStore((state) => state.sessions);
  const archivedSessions = useSessionStore((state) => state.archivedSessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const loadArchivedSessions = useSessionStore((state) => state.loadArchivedSessions);
  const archiveSession = useSessionStore((state) => state.archiveSession);
  const restoreSession = useSessionStore((state) => state.restoreSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);

  const repos = useRepoStore((state) => state.repos);
  const loadRepos = useRepoStore((state) => state.loadRepos);
  const addRepoViaDialog = useRepoStore((state) => state.addRepoViaDialog);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [metaHeld, setMetaHeld] = useState(false);
  const repoPickerRef = useRef<HTMLDivElement>(null);

  // Cmd+1…9 to jump to sessions
  useSessionShortcuts(sessions, setActiveSession);

  // Branch cache: repoPath → branch name
  const [branches, setBranches] = useState<Map<string, string | null>>(new Map());

  // Load repos, sessions, and branches on mount
  useEffect(() => {
    loadRepos();
    loadSessions();
    loadArchivedSessions();
  }, [loadRepos, loadSessions, loadArchivedSessions]);

  // Fetch branches for all unique repo paths when sessions change
  useEffect(() => {
    if (!window.electronAPI) return;
    const uniquePaths = [...new Set(sessions.map((s) => s.repoPath))];
    for (const repoPath of uniquePaths) {
      window.electronAPI.getRepoBranch(repoPath).then((branch) => {
        setBranches((prev) => {
          if (prev.get(repoPath) === branch) return prev;
          const next = new Map(prev);
          next.set(repoPath, branch);
          return next;
        });
      });
    }
  }, [sessions]);

  // Track Cmd key held state for shortcut overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") setMetaHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") setMetaHeld(false);
    };
    const handleBlur = () => setMetaHeld(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const handleNewSessionClick = useCallback(async () => {
    const repo = await addRepoViaDialog();
    if (repo) {
      await createSession(repo.path, "claude");
    }
  }, [addRepoViaDialog, createSession]);

  return (
    <aside className="w-60 border-r border-white/[0.06] bg-transparent flex flex-col">
      {/* Draggable title bar + header */}
      <div className="h-12 flex items-center px-4 [-webkit-app-region:drag]">
        <span className="text-[13px] font-medium text-text-muted ml-16 flex-1">Codez</span>
        <div className="[-webkit-app-region:no-drag]" ref={repoPickerRef}>
          <button
            type="button"
            onClick={handleNewSessionClick}
            className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
            title="New session"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* Session list — flat, sorted by recency */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-text-muted">
              {repos.length === 0 ? "Add a folder to get started" : "No sessions yet"}
            </p>
          </div>
        ) : (
          sessions.map((session, index) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => setActiveSession(session.id)}
              onArchive={() => archiveSession(session.id)}
              branchName={branches.get(session.repoPath)}
              shortcutNumber={metaHeld && index < 9 ? index + 1 : null}
            />
          ))
        )}

        {/* Add folder link — only when no repos exist */}
        {repos.length === 0 && (
          <button
            type="button"
            onClick={addRepoViaDialog}
            className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-accent transition-colors [-webkit-app-region:no-drag]"
          >
            + Add folder...
          </button>
        )}
      </div>

      {/* Archive accordion */}
      {archivedSessions.length > 0 && (
        <div className="border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setArchiveOpen(!archiveOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <ChevronIcon open={archiveOpen} />
            <span>Archive</span>
            <span className="ml-auto text-[10px] bg-white/5 rounded-full px-1.5 py-0.5">{archivedSessions.length}</span>
          </button>
          {archiveOpen && (
            <div className="px-1.5 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
              {archivedSessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onClick={() => setActiveSession(session.id)}
                  onRestore={() => restoreSession(session.id)}
                  onDelete={() => deleteSession(session.id)}
                  branchName={branches.get(session.repoPath)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
