import type { AgentType } from "@shared/agent-types";
import { useCallback, useEffect, useRef, useState } from "react";

interface NewSessionDialogProps {
  defaultAgent: AgentType;
  onConfirm: (options: { agentType: AgentType; useWorktree: boolean }) => void;
  onDismiss: () => void;
}

export function NewSessionDialog({ defaultAgent, onConfirm, onDismiss }: NewSessionDialogProps) {
  const [agentType, setAgentType] = useState<AgentType>(defaultAgent);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(() => {
    onConfirm({ agentType, useWorktree: false });
  }, [agentType, onConfirm]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirm();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    },
    [handleConfirm, onDismiss],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    createButtonRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-[360px] rounded-xl bg-elevated p-5 shadow-xl border border-border-subtle">
        <h3 className="text-base font-semibold text-text-primary mb-4">New Session</h3>

        {/* Agent picker */}
        <div className="mb-4">
          <label className="block text-xs text-text-muted mb-1.5">Agent</label>
          <div className="flex gap-2">
            {(["claude", "mistral"] as const).map((agent) => (
              <button
                key={agent}
                type="button"
                onClick={() => setAgentType(agent)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors border ${
                  agentType === agent
                    ? "bg-accent/15 border-accent text-accent"
                    : "bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:border-border"
                }`}
              >
                {agent === "claude" ? "Claude" : "Mistral"}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-md text-sm bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            ref={createButtonRef}
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-contrast hover:bg-accent/90 transition-colors"
          >
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
}
