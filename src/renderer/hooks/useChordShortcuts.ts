import type { SessionInfo } from "@shared/agent-types";
import { useEffect } from "react";

/**
 * Simple Cmd+1…9 shortcuts to jump to sessions by position.
 * No two-phase chord — just Cmd+N goes to the Nth session in the list.
 */
export function useSessionShortcuts(sessions: SessionInfo[], onSelectSession: (sessionId: string) => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) return;

      const digit = Number.parseInt(event.key, 10);
      if (Number.isNaN(digit) || digit < 1 || digit > 9) return;

      const index = digit - 1;
      const session = sessions[index];
      if (!session) return;

      event.preventDefault();
      onSelectSession(session.id);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessions, onSelectSession]);
}
