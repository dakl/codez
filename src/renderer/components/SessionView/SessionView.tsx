import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { TerminalView } from "./TerminalView";

export function SessionView() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const [escPrimed, setEscPrimed] = useState(false);
  const escTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track which sessions have been opened (PTY created) this app session.
  // Prevents spawning PTYs for every session loaded from DB.
  const [openedSessionIds, setOpenedSessionIds] = useState<Set<string>>(new Set());

  // When a session becomes active, mark it as opened
  useEffect(() => {
    if (activeSessionId) {
      setOpenedSessionIds((prev) => {
        if (prev.has(activeSessionId)) return prev;
        const next = new Set(prev);
        next.add(activeSessionId);
        return next;
      });
    }
  }, [activeSessionId]);

  const session = sessions.find((s) => s.id === activeSessionId);
  const isRunning = session?.status === "running";

  // Double-Esc to kill PTY
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isRunning || !activeSessionId) return;

      if (escPrimed) {
        if (escTimerRef.current) clearTimeout(escTimerRef.current);
        setEscPrimed(false);
        window.electronAPI.ptyKill(activeSessionId);
      } else {
        setEscPrimed(true);
        escTimerRef.current = setTimeout(() => setEscPrimed(false), 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (escTimerRef.current) clearTimeout(escTimerRef.current);
    };
  }, [isRunning, activeSessionId, escPrimed]);

  useEffect(() => {
    if (!isRunning) setEscPrimed(false);
  }, [isRunning]);

  const worktreePath = session?.worktreePath;
  const folderName = worktreePath?.split("/").pop() ?? null;

  const [liveBranch, setLiveBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!worktreePath) {
      setLiveBranch(null);
      return;
    }

    const fetchBranch = () => {
      window.electronAPI.getRepoBranch(worktreePath).then((branch) => {
        setLiveBranch(branch);
      });
    };

    fetchBranch();
    const interval = setInterval(fetchBranch, 3000);
    return () => clearInterval(interval);
  }, [worktreePath]);

  if (!activeSessionId || !session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        {/* Offset left by half the sidebar width (w-60 = 240px) to center in the full window */}
        <div className="text-center -ml-60">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Codez</h1>
          <p className="text-sm text-text-muted">Press ⌘N to start a new session</p>
        </div>
      </div>
    );
  }

  // Only render TerminalViews for sessions that have been activated
  const openedSessions = sessions.filter((s) => openedSessionIds.has(s.id));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Session header */}
      <div className="h-10 flex items-center px-4 border-b border-border gap-2">
        <span className="text-sm font-medium text-text-primary font-mono">{folderName}</span>
        {liveBranch && <span className="text-xs text-text-muted font-mono">{liveBranch}</span>}
        <StatusBadge status={session.status} />
      </div>

      {/* Esc cancel indicator */}
      {escPrimed && (
        <div className="px-4 py-1.5 text-center text-xs text-warning bg-warning/10 border-t border-warning/20">
          Press Esc again to stop the agent
        </div>
      )}

      {/* Terminal stack — only opened sessions get a PTY */}
      <div className="flex-1 min-h-0 relative">
        {openedSessions.map((s) => (
          <TerminalView
            key={s.id}
            sessionId={s.id}
            agentType={s.agentType}
            worktreePath={s.worktreePath}
            isActive={s.id === activeSessionId}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    running: "bg-success",
    waiting_for_input: "bg-warning",
    error: "bg-error",
    completed: "bg-info",
    idle: "bg-text-muted",
    paused: "bg-text-muted",
  };

  return <span className={`ml-2 inline-block w-2 h-2 rounded-full ${colorMap[status] ?? "bg-text-muted"}`} />;
}
