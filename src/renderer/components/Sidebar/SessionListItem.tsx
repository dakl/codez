import type { SessionInfo } from "@shared/agent-types";

interface SessionListItemProps {
  session: SessionInfo;
  isActive: boolean;
  onClick: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  branchName?: string | null;
  shortcutNumber?: number | null;
}

const statusDotColor: Record<string, string> = {
  running: "bg-success",
  waiting_for_input: "bg-warning",
  error: "bg-error",
  completed: "bg-info",
  idle: "bg-text-muted/40",
  paused: "bg-text-muted/40",
  archived: "bg-text-muted/20",
};

function folderName(repoPath: string): string {
  return repoPath.split("/").pop() || repoPath;
}

export function SessionListItem({
  session,
  isActive,
  onClick,
  onArchive,
  onRestore,
  onDelete,
  branchName,
  shortcutNumber,
}: SessionListItemProps) {
  const isArchived = session.status === "archived";
  const dotColor = statusDotColor[session.status] ?? "bg-text-muted/20";
  const folder = folderName(session.repoPath);

  return (
    <div
      className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-default ${
        isActive
          ? "bg-accent/20 text-text-primary ring-1 ring-accent/30"
          : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
      } ${isArchived ? "opacity-50" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      role="button"
      tabIndex={0}
    >
      {/* Shortcut badge — only visible when Cmd is held */}
      {shortcutNumber != null && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded bg-accent/80 text-[10px] font-semibold text-white shadow-sm">
          {shortcutNumber}
        </span>
      )}

      {/* Status dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-tight truncate font-mono">{folder}</div>
        {branchName && (
          <div className="text-[11px] leading-tight text-text-muted truncate mt-0.5 font-mono">{branchName}</div>
        )}
      </div>

      {/* Hover actions */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        {isArchived ? (
          <>
            {onRestore && (
              <ActionButton onClick={onRestore} title="Restore">
                <RestoreIcon />
              </ActionButton>
            )}
            {onDelete && (
              <ActionButton onClick={onDelete} title="Delete" hoverColor="hover:text-error">
                <TrashIcon />
              </ActionButton>
            )}
          </>
        ) : (
          onArchive && (
            <ActionButton onClick={onArchive} title="Archive" hoverColor="hover:text-error">
              <ArchiveIcon />
            </ActionButton>
          )
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  hoverColor = "hover:text-text-primary",
  children,
}: {
  onClick: () => void;
  title: string;
  hoverColor?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`p-0.5 rounded text-text-muted ${hoverColor} transition-colors`}
    >
      {children}
    </button>
  );
}

function ArchiveIcon() {
  return (
    <svg
      width="13"
      height="13"
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
      width="13"
      height="13"
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
      width="13"
      height="13"
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
