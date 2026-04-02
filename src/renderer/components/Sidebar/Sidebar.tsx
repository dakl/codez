import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionShortcuts } from "../../hooks/useChordShortcuts";
import { useRepoStore } from "../../stores/repoStore";
import { useSessionStore } from "../../stores/sessionStore";
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

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [metaHeld, setMetaHeld] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
    <aside
      className={`${collapsed ? "w-10" : "w-60"} border-r border-white/[0.06] bg-transparent flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden`}
    >
      {/* Draggable title bar + header */}
      <div className="h-12 flex items-center px-2 [-webkit-app-region:drag] shrink-0">
        {!collapsed && (
          <span className="text-[13px] font-medium text-text-muted ml-16 flex-1 whitespace-nowrap overflow-hidden">Codez</span>
        )}
        <div className={`flex items-center gap-1 [-webkit-app-region:no-drag] ${collapsed ? "mx-auto" : ""}`} ref={repoPickerRef}>
          {!collapsed && (
            <button
              type="button"
              onClick={handleNewSessionClick}
              className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
              title="New session"
            >
              <PlusIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      </div>

      {/* Session list — sorted by user-defined order */}
      {!collapsed && (
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
      )}

      {/* Archive accordion */}
      {!collapsed && archivedSessions.length > 0 && (
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

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
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
      className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
    >
      <polyline points="15 18 9 12 15 6" />
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
