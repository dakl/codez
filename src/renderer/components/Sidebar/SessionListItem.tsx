import type { SessionInfo } from "@shared/agent-types";

interface SessionListItemProps {
  session: SessionInfo;
  isActive: boolean;
  onClick: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

export function SessionListItem({ session, isActive, onClick, onArchive, onRestore, onDelete }: SessionListItemProps) {
  const statusColor: Record<string, string> = {
    running: "bg-success",
    waiting_for_input: "bg-warning",
    error: "bg-error",
    completed: "bg-info",
    idle: "bg-text-muted",
    paused: "bg-text-muted",
    archived: "bg-text-muted",
  };

  const isArchived = session.status === "archived";

  return (
    <div
      className={`group relative w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
        isActive ? "bg-surface-hover text-text-primary" : "text-text-secondary hover:bg-surface hover:text-text-primary"
      } ${isArchived ? "opacity-60" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor[session.status] ?? "bg-text-muted"}`} />
        <span className="text-sm truncate flex-1">{session.name}</span>
        {session.status === "waiting_for_input" && (
          <span className="text-[10px] text-warning font-medium">WAITING</span>
        )}

        {/* Action buttons — visible on hover */}
        <div className="hidden group-hover:flex items-center gap-0.5 ml-auto">
          {isArchived ? (
            <>
              {onRestore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                  className="p-0.5 rounded text-text-muted hover:text-success transition-colors"
                  title="Restore session"
                >
                  <RestoreIcon />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-0.5 rounded text-text-muted hover:text-error transition-colors"
                  title="Delete permanently"
                >
                  <TrashIcon />
                </button>
              )}
            </>
          ) : (
            onArchive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                className="p-0.5 rounded text-text-muted hover:text-error transition-colors"
                title="Archive session"
              >
                <ArchiveIcon />
              </button>
            )
          )}
        </div>
      </div>
      <div className="text-xs text-text-muted ml-3.5 mt-0.5 truncate">{session.agentType}</div>
    </div>
  );
}

function ArchiveIcon() {
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
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function RestoreIcon() {
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
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function TrashIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
