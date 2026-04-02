import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionShortcuts } from "../../hooks/useChordShortcuts";
import { useRepoStore } from "../../stores/repoStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useThemeStore } from "../../stores/themeStore";
import { NewSessionDialog } from "./NewSessionDialog";
import { SessionListItem, type SessionListItemProps } from "./SessionListItem";
import { WorktreeDeleteDialog } from "./WorktreeDeleteDialog";

export function Sidebar() {
  const sessions = useSessionStore((state) => state.sessions);
  const archivedSessions = useSessionStore((state) => state.archivedSessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const loadArchivedSessions = useSessionStore((state) => state.loadArchivedSessions);
  const archiveSession = useSessionStore((state) => state.archiveSession);
  const archiveSessionWithWorktreeCleanup = useSessionStore((state) => state.archiveSessionWithWorktreeCleanup);
  const restoreSession = useSessionStore((state) => state.restoreSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const deleteSessionWithWorktreeCleanup = useSessionStore((state) => state.deleteSessionWithWorktreeCleanup);
  const pendingNewSessionRepo = useSessionStore((state) => state.pendingNewSessionRepo);
  const setPendingNewSessionRepo = useSessionStore((state) => state.setPendingNewSessionRepo);
  const pendingWorktreeSession = useSessionStore((state) => state.pendingWorktreeSession);
  const pendingWorktreeContext = useSessionStore((state) => state.pendingWorktreeContext);
  const showWorktreeDialog = useSessionStore((state) => state.showWorktreeDialog);
  const dismissWorktreeDialog = useSessionStore((state) => state.dismissWorktreeDialog);

  const repos = useRepoStore((state) => state.repos);
  const loadRepos = useRepoStore((state) => state.loadRepos);
  const addRepoViaDialog = useRepoStore((state) => state.addRepoViaDialog);

  const reorderSessions = useSessionStore((state) => state.reorderSessions);

  const toggleSettings = useThemeStore((state) => state.toggleSettings);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [metaHeld, setMetaHeld] = useState(false);
  const repoPickerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeIndex = sessions.findIndex((s) => s.id === active.id);
      const overIndex = sessions.findIndex((s) => s.id === over.id);
      if (activeIndex !== -1 && overIndex !== -1) {
        reorderSessions(activeIndex, overIndex);
      }
    },
    [sessions, reorderSessions],
  );

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
      setPendingNewSessionRepo(repo);
    }
  }, [addRepoViaDialog, setPendingNewSessionRepo]);

  const handleNewSessionConfirm = useCallback(
    async (options: { branchName?: string; baseBranch?: string; fetchFirst?: boolean }) => {
      if (!pendingNewSessionRepo) return;
      await createSession({
        repoPath: pendingNewSessionRepo.path,
        agentType: "claude",
        branchName: options.branchName,
        baseBranch: options.baseBranch,
        fetchFirst: options.fetchFirst,
      });
      setPendingNewSessionRepo(null);
    },
    [pendingNewSessionRepo, createSession, setPendingNewSessionRepo],
  );

  const handleArchiveSession = useCallback(
    (session: (typeof sessions)[number]) => {
      if (session.branchName) {
        showWorktreeDialog(session, "archive");
      } else {
        archiveSession(session.id);
      }
    },
    [archiveSession, showWorktreeDialog],
  );

  const handleDeleteSession = useCallback(
    (session: (typeof archivedSessions)[number]) => {
      if (session.branchName) {
        showWorktreeDialog(session, "delete");
      } else {
        deleteSession(session.id);
      }
    },
    [deleteSession, showWorktreeDialog],
  );

  const handleWorktreeKeep = useCallback(() => {
    if (!pendingWorktreeSession) return;
    if (pendingWorktreeContext === "archive") {
      archiveSessionWithWorktreeCleanup(pendingWorktreeSession.id, false);
    } else {
      deleteSessionWithWorktreeCleanup(pendingWorktreeSession.id, false);
    }
  }, [
    pendingWorktreeSession,
    pendingWorktreeContext,
    archiveSessionWithWorktreeCleanup,
    deleteSessionWithWorktreeCleanup,
  ]);

  const handleWorktreeDelete = useCallback(() => {
    if (!pendingWorktreeSession) return;
    if (pendingWorktreeContext === "archive") {
      archiveSessionWithWorktreeCleanup(pendingWorktreeSession.id, true);
    } else {
      deleteSessionWithWorktreeCleanup(pendingWorktreeSession.id, true);
    }
  }, [
    pendingWorktreeSession,
    pendingWorktreeContext,
    archiveSessionWithWorktreeCleanup,
    deleteSessionWithWorktreeCleanup,
  ]);

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

      {/* Session list — sorted by user-defined order */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-text-muted">
              {repos.length === 0 ? "Add a folder to get started" : "No sessions yet"}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sessions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sessions.map((session, index) => (
                <SortableSessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onClick={() => setActiveSession(session.id)}
                  onArchive={() => handleArchiveSession(session)}
                  branchName={session.branchName ?? branches.get(session.repoPath)}
                  shortcutNumber={metaHeld && index < 9 ? index + 1 : null}
                />
              ))}
            </SortableContext>
          </DndContext>
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
                  onDelete={() => handleDeleteSession(session)}
                  branchName={session.branchName ?? branches.get(session.repoPath)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keyboard shortcuts panel */}
      {shortcutsOpen && (
        <div className="border-t border-white/[0.06] px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-2">Shortcuts</p>
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted">{label}</span>
              <kbd className="text-[10px] text-text-muted font-mono bg-white/5 rounded px-1.5 py-0.5 shrink-0">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar: keyboard shortcuts toggle + settings */}
      <div className="border-t border-white/[0.06] flex items-center px-2 py-1.5">
        <button
          type="button"
          onClick={() => setShortcutsOpen(!shortcutsOpen)}
          className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
            shortcutsOpen
              ? "text-text-primary bg-white/10"
              : "text-text-muted hover:text-text-primary hover:bg-white/10"
          }`}
          title="Keyboard shortcuts"
        >
          <KeyboardIcon />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleSettings}
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
          title="Settings (⌘,)"
        >
          <GearIcon />
        </button>
      </div>

      {/* New session dialog */}
      {pendingNewSessionRepo && (
        <NewSessionDialog
          repoName={pendingNewSessionRepo.name}
          repoPath={pendingNewSessionRepo.path}
          onConfirm={handleNewSessionConfirm}
          onCancel={() => setPendingNewSessionRepo(null)}
        />
      )}

      {/* Worktree cleanup dialog (archive or delete) */}
      {pendingWorktreeSession?.branchName && pendingWorktreeContext && (
        <WorktreeDeleteDialog
          branchName={pendingWorktreeSession.branchName}
          context={pendingWorktreeContext}
          onDeleteBranch={handleWorktreeDelete}
          onKeepBranch={handleWorktreeKeep}
          onCancel={dismissWorktreeDialog}
        />
      )}
    </aside>
  );
}

const SHORTCUTS = [
  { keys: "⌘N", label: "New session" },
  { keys: "⌘,", label: "Settings" },
  { keys: "⌘B", label: "Toggle sidebar" },
  { keys: "⌘1-9", label: "Jump to session" },
  { keys: "Esc×2", label: "Stop agent" },
];

function SortableSessionItem(props: Omit<SessionListItemProps, "sortableProps">) {
  const sortable = useSortable({ id: props.session.id });
  return <SessionListItem {...props} sortableProps={sortable} />;
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

function GearIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function KeyboardIcon() {
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
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}
