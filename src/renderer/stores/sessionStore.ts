import type { AgentEvent, AgentMessage, PermissionRequestData, SessionInfo, SessionStatus } from "@shared/agent-types";
import { create } from "zustand";

interface SessionState {
  sessions: SessionInfo[];
  archivedSessions: SessionInfo[];
  activeSessionId: string | null;
  messages: Map<string, AgentMessage[]>;
  streamingText: Map<string, string>;
  streamingThinking: Map<string, string>;
  pendingPermissions: Map<string, PermissionRequestData>;

  // Actions
  loadSessions: (repoPath?: string) => Promise<void>;
  loadArchivedSessions: (repoPath?: string) => Promise<void>;
  createSession: (repoPath: string, agentType: "claude" | "mistral" | "gemini") => Promise<SessionInfo>;
  setActiveSession: (sessionId: string | null) => void;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  restoreSession: (sessionId: string) => Promise<void>;
  respondPermission: (sessionId: string, approved: boolean) => Promise<void>;
  handleAgentEvent: (event: AgentEvent) => void;
  handleStatusChange: (sessionId: string, status: SessionStatus) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  archivedSessions: [],
  activeSessionId: null,
  messages: new Map(),
  streamingText: new Map(),
  streamingThinking: new Map(),
  pendingPermissions: new Map(),

  loadSessions: async (repoPath) => {
    const sessions = await window.electronAPI.listSessions(repoPath);
    set({ sessions });
  },

  loadArchivedSessions: async (repoPath) => {
    const archivedSessions = await window.electronAPI.listArchivedSessions(repoPath);
    set({ archivedSessions });
  },

  createSession: async (repoPath, agentType) => {
    const session = await window.electronAPI.createSession(repoPath, agentType);
    set((state) => ({ sessions: [session, ...state.sessions], activeSessionId: session.id }));
    return session;
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (sessionId) {
      get().loadMessages(sessionId);
    }
  },

  sendMessage: async (sessionId, message) => {
    // Optimistically add the user message to the UI
    const optimisticMessage: AgentMessage = {
      id: `temp-${Date.now()}`,
      sessionId,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(sessionId) ?? [];
      newMessages.set(sessionId, [...existing, optimisticMessage]);
      return { messages: newMessages };
    });

    // Update session status optimistically
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, status: "running" as const } : s)),
    }));

    await window.electronAPI.sendMessage(sessionId, message);
  },

  stopSession: async (sessionId) => {
    await window.electronAPI.stopSession(sessionId);
    set((state) => {
      const newStreamingText = new Map(state.streamingText);
      newStreamingText.delete(sessionId);
      const newStreamingThinking = new Map(state.streamingThinking);
      newStreamingThinking.delete(sessionId);
      return {
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, status: "waiting_for_input" as const } : s)),
        streamingText: newStreamingText,
        streamingThinking: newStreamingThinking,
      };
    });
  },

  loadMessages: async (sessionId) => {
    const messages = await window.electronAPI.getSessionMessages(sessionId);
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(sessionId, messages);
      return { messages: newMessages };
    });
  },

  deleteSession: async (sessionId) => {
    await window.electronAPI.deleteSession(sessionId);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      archivedSessions: state.archivedSessions.filter((s) => s.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    }));
  },

  archiveSession: async (sessionId) => {
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
        sessions: restored ? [restored, ...state.sessions] : state.sessions,
      };
    });
  },

  respondPermission: async (sessionId, approved) => {
    const pending = get().pendingPermissions.get(sessionId);
    if (!pending) return;

    set((state) => {
      const newPending = new Map(state.pendingPermissions);
      newPending.delete(sessionId);
      return { pendingPermissions: newPending };
    });

    await window.electronAPI.respondPermission(
      sessionId,
      pending.requestId,
      approved,
      approved ? pending.toolInput : undefined,
    );
  },

  handleAgentEvent: (event) => {
    if (event.type === "permission_request") {
      set((state) => {
        const newPending = new Map(state.pendingPermissions);
        newPending.set(event.sessionId, event.data as unknown as PermissionRequestData);
        return { pendingPermissions: newPending };
      });
    }

    if (event.type === "thinking_delta") {
      set((state) => {
        const newStreamingThinking = new Map(state.streamingThinking);
        const current = newStreamingThinking.get(event.sessionId) ?? "";
        newStreamingThinking.set(event.sessionId, current + (event.data.text as string));
        return { streamingThinking: newStreamingThinking };
      });
    }

    if (event.type === "text_delta") {
      // When text starts arriving, clear thinking (thinking phase is over)
      set((state) => {
        const newStreamingText = new Map(state.streamingText);
        const current = newStreamingText.get(event.sessionId) ?? "";
        newStreamingText.set(event.sessionId, current + (event.data.text as string));
        return { streamingText: newStreamingText };
      });
    }

    // Reload messages when tool activity or complete messages are persisted
    if (event.type === "tool_use_start" || event.type === "tool_result") {
      get().loadMessages(event.sessionId);
    }

    if (event.type === "message_complete") {
      // Clear streaming text and thinking, reload messages from DB
      set((state) => {
        const newStreamingText = new Map(state.streamingText);
        newStreamingText.delete(event.sessionId);
        const newStreamingThinking = new Map(state.streamingThinking);
        newStreamingThinking.delete(event.sessionId);
        return { streamingText: newStreamingText, streamingThinking: newStreamingThinking };
      });
      get().loadMessages(event.sessionId);
    }

    if (event.type === "session_end") {
      set((state) => {
        const newPending = new Map(state.pendingPermissions);
        newPending.delete(event.sessionId);
        return { pendingPermissions: newPending };
      });
    }

    if (event.type === "error") {
      const errorMessage: AgentMessage = {
        id: `error-${Date.now()}`,
        sessionId: event.sessionId,
        role: "system",
        content: event.data.message as string,
        isError: true,
        timestamp: new Date().toISOString(),
      };
      set((state) => {
        const newMessages = new Map(state.messages);
        const existing = newMessages.get(event.sessionId) ?? [];
        newMessages.set(event.sessionId, [...existing, errorMessage]);
        const newStreamingText = new Map(state.streamingText);
        newStreamingText.delete(event.sessionId);
        const newStreamingThinking = new Map(state.streamingThinking);
        newStreamingThinking.delete(event.sessionId);
        const newPending = new Map(state.pendingPermissions);
        newPending.delete(event.sessionId);
        return {
          messages: newMessages,
          streamingText: newStreamingText,
          streamingThinking: newStreamingThinking,
          pendingPermissions: newPending,
        };
      });
    }
  },

  handleStatusChange: (sessionId, status) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, status } : s)),
    }));
  },
}));
