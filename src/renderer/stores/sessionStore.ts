import type { SessionInfo, SessionStatus } from "@shared/agent-types";
import { create } from "zustand";

interface SessionState {
  sessions: SessionInfo[];
  archivedSessions: SessionInfo[];
  activeSessionId: string | null;

  // Actions
  loadSessions: () => Promise<void>;
  loadArchivedSessions: () => Promise<void>;
  createSession: (repoPath: string, agentType: "claude" | "gemini") => Promise<SessionInfo>;
  setActiveSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  restoreSession: (sessionId: string) => Promise<void>;
  reorderSessions: (activeIndex: number, overIndex: number) => void;
  handleStatusChange: (sessionId: string, status: SessionStatus) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  archivedSessions: [],
  activeSessionId: null,

  loadSessions: async () => {
    const sessions = await window.electronAPI.listSessions();
    set({ sessions });
  },

  loadArchivedSessions: async () => {
    const archivedSessions = await window.electronAPI.listArchivedSessions();
    set({ archivedSessions });
  },

  createSession: async (repoPath, agentType) => {
    const session = await window.electronAPI.createSession(repoPath, agentType);
    set((state) => ({ sessions: [...state.sessions, session], activeSessionId: session.id }));
    return session;
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  deleteSession: async (sessionId) => {
    await window.electronAPI.ptyKill(sessionId).catch(() => {});
    await window.electronAPI.deleteSession(sessionId);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      archivedSessions: state.archivedSessions.filter((s) => s.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    }));
  },

  archiveSession: async (sessionId) => {
    await window.electronAPI.ptyKill(sessionId).catch(() => {});
    await window.electronAPI.archiveSession(sessionId);
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      const archived = session ? { ...session, status: "archived" as const } : null;
      return {
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        archivedSessions: archived ? [archived, ...state.archivedSessions] : state.archivedSessions,
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
      };
    });
  },

  restoreSession: async (sessionId) => {
    await window.electronAPI.restoreSession(sessionId);
    set((state) => {
      const session = state.archivedSessions.find((s) => s.id === sessionId);
      const restored = session ? { ...session, status: "idle" as const } : null;
      return {
        archivedSessions: state.archivedSessions.filter((s) => s.id !== sessionId),
        sessions: restored ? [...state.sessions, restored] : state.sessions,
      };
    });
  },

  reorderSessions: (activeIndex, overIndex) => {
    set((state) => {
      const reordered = [...state.sessions];
      const [moved] = reordered.splice(activeIndex, 1);
      reordered.splice(overIndex, 0, moved);
      window.electronAPI.reorderSessions(reordered.map((s) => s.id));
      return { sessions: reordered };
    });
  },

  handleStatusChange: (sessionId, status) => {
    if (status === "archived") {
      // Auto-archived on clean exit — move to archived list
      set((state) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        const archived = session ? { ...session, status: "archived" as const } : null;
        return {
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          archivedSessions: archived ? [archived, ...state.archivedSessions] : state.archivedSessions,
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        };
      });
    } else {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, status } : s)),
      }));
    }
  },
}));
