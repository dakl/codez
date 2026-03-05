import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { PermissionDialog } from "../PermissionDialog";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { StreamingIndicator } from "./StreamingIndicator";
import { ThinkingIndicator } from "./ThinkingIndicator";

export function SessionView() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const messages = useSessionStore((state) => state.messages);
  const streamingText = useSessionStore((state) => state.streamingText);
  const streamingThinking = useSessionStore((state) => state.streamingThinking);
  const sendMessage = useSessionStore((state) => state.sendMessage);
  const stopSession = useSessionStore((state) => state.stopSession);
  const pendingPermissions = useSessionStore((state) => state.pendingPermissions);
  const respondPermission = useSessionStore((state) => state.respondPermission);
  const alwaysAllowTool = useSessionStore((state) => state.alwaysAllowTool);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const [escPrimed, setEscPrimed] = useState(false);
  const escTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = sessions.find((s) => s.id === activeSessionId);
  const sessionMessages = activeSessionId ? (messages.get(activeSessionId) ?? []) : [];
  const currentStreamingText = activeSessionId ? (streamingText.get(activeSessionId) ?? "") : "";
  const currentThinkingText = activeSessionId ? (streamingThinking.get(activeSessionId) ?? "") : "";

  const isRunning = session?.status === "running";
  const pendingPermission = activeSessionId ? pendingPermissions.get(activeSessionId) : undefined;

  // Double-Esc to cancel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isRunning || !activeSessionId) return;

      if (escPrimed) {
        // Second Esc within the window — stop the agent
        if (escTimerRef.current) clearTimeout(escTimerRef.current);
        setEscPrimed(false);
        stopSession(activeSessionId);
      } else {
        // First Esc — prime with 1s window
        setEscPrimed(true);
        escTimerRef.current = setTimeout(() => setEscPrimed(false), 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (escTimerRef.current) clearTimeout(escTimerRef.current);
    };
  }, [isRunning, activeSessionId, escPrimed, stopSession]);

  // Clear primed state when session stops running
  useEffect(() => {
    if (!isRunning) setEscPrimed(false);
  }, [isRunning]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottom.current = distanceFromBottom < 50;
  }, []);

  // Tail-follow: only auto-scroll when user is at the bottom
  useEffect(() => {
    if (isAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  if (!activeSessionId || !session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Codez</h1>
          <p className="text-sm text-text-muted">Press ⌘N to start a new session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Session header */}
      <div className="h-10 flex items-center px-4 border-b border-border">
        <span className="text-sm font-medium text-text-secondary">{session.name}</span>
        <StatusBadge status={session.status} />
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4">
        {sessionMessages.length === 0 && !currentStreamingText && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-text-muted">Send a message to start coding</p>
          </div>
        )}
        {sessionMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isRunning && (currentThinkingText || !currentStreamingText) && (
          <ThinkingIndicator text={currentThinkingText} />
        )}
        {currentStreamingText && <StreamingIndicator text={currentStreamingText} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Esc cancel indicator */}
      {escPrimed && (
        <div className="px-4 py-1.5 text-center text-xs text-warning bg-warning/10 border-t border-warning/20">
          Press Esc again to stop the agent
        </div>
      )}

      {/* Input */}
      <MessageInput onSend={(message) => sendMessage(activeSessionId, message)} disabled={isRunning} />

      {pendingPermission && (
        <PermissionDialog
          permission={pendingPermission}
          onApprove={() => respondPermission(activeSessionId, true)}
          onAlwaysAllow={() => alwaysAllowTool(activeSessionId)}
          onDeny={() => respondPermission(activeSessionId, false)}
        />
      )}
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
