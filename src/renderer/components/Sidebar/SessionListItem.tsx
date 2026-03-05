import type { SessionInfo } from "@shared/agent-types";

interface SessionListItemProps {
  session: SessionInfo;
  isActive: boolean;
  onClick: () => void;
}

export function SessionListItem({ session, isActive, onClick }: SessionListItemProps) {
  const statusColor: Record<string, string> = {
    running: "bg-success",
    waiting_for_input: "bg-warning",
    error: "bg-error",
    completed: "bg-info",
    idle: "bg-text-muted",
    paused: "bg-text-muted",
  };

  return (
    <button
      onClick={onClick}
      type="button"
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? "bg-surface-hover text-text-primary"
          : "text-text-secondary hover:bg-surface hover:text-text-primary"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor[session.status] ?? "bg-text-muted"}`} />
        <span className="text-sm truncate">{session.name}</span>
        {session.status === "waiting_for_input" && (
          <span className="ml-auto text-[10px] text-warning font-medium">WAITING</span>
        )}
      </div>
      <div className="text-xs text-text-muted ml-3.5 mt-0.5 truncate">{session.agentType}</div>
    </button>
  );
}
