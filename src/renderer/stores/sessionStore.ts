import { create } from "zustand";
import type { SessionInfo, AgentMessage, AgentEvent, SessionStatus } from "@shared/agent-types";

interface SessionState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  messages: Map<string, AgentMessage[]>;
  streamingText: Map<string, string>;
  streamingThinking: Map<string, string>;

  // Actions
  loadSessions: (repoPath?: string) => Promise<void>;
  createSession: (repoPath: string, agentType: "claude" | "mistral" | "gemini") => Promise<SessionInfo>;
  setActiveSession: (sessionId: string | null) => void;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  handleAgentEvent: (event: AgentEvent) => void;
  handleStatusChange: (sessionId: string, status: SessionStatus) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: new Map(),
  streamingText: new Map(),
  streamingThinking: new Map(),

  loadSessions: async (repoPath) => {
    const sessions = await window.electronAPI.listSessions(repoPath);
    set({ sessions });
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
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, status: "waiting_for_input" as const } : s,
        ),
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
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    }));
  },

  handleAgentEvent: (event) => {
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

    if (event.type === "error") {
      // Show error inline as a system message
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
        return { messages: newMessages, streamingText: newStreamingText, streamingThinking: newStreamingThinking };
      });
    }
  },

  handleStatusChange: (sessionId, status) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, status } : s)),
    }));
  },
}));
