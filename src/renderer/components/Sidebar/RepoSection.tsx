import type { SessionInfo } from "@shared/agent-types";
import type { RepoInfo } from "@shared/types";
import { useState } from "react";
import { SessionListItem } from "./SessionListItem";

interface RepoSectionProps {
  repo: RepoInfo;
  repoIndex: number;
  sessions: SessionInfo[];
  activeSessionId: string | null;
  isChordActive: boolean;
  onSelectSession: (id: string) => void;
  onNewSession: (repoPath: string) => void;
  onArchiveSession: (id: string) => void;
}

export function RepoSection({
  repo,
  repoIndex,
  sessions,
  activeSessionId,
  isChordActive,
  onSelectSession,
  onNewSession,
  onArchiveSession,
}: RepoSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const repoDigit = repoIndex + 1;

  return (
    <div className={`${isChordActive ? "bg-accent/5 rounded-lg" : ""} transition-colors`}>
      {/* Repo header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
      >
        <ChevronIcon open={!collapsed} />
        <span className="truncate flex-1 text-left">{repo.name}</span>
        <span
          className={`text-[10px] font-mono px-1 py-0.5 rounded ${
            isChordActive ? "bg-accent/20 text-accent" : "bg-surface-hover text-text-muted opacity-50"
          } transition-colors`}
        >
          ⌘{repoDigit}
        </span>
      </button>

      {/* Session list */}
      {!collapsed && (
        <div className="px-1 pb-1 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-[11px] text-text-muted px-3 py-1">No sessions</p>
          ) : (
            sessions.map((session, sessionIndex) => (
              <SessionListItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => onSelectSession(session.id)}
                onArchive={() => onArchiveSession(session.id)}
                shortcutHint={`⌘${repoDigit}⌘${sessionIndex + 1}`}
                isChordHighlighted={isChordActive}
              />
            ))
          )}
          <button
            type="button"
            onClick={() => onNewSession(repo.path)}
            className="w-full flex items-center px-3 py-1 text-[11px] text-text-muted hover:text-accent transition-colors"
          >
            <span className="flex-1 text-left">+ New Session</span>
            <span className="text-[10px] font-mono opacity-40">⌘{repoDigit}⌘N</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform flex-shrink-0 ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
