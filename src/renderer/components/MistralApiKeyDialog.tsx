import { useCallback, useEffect, useRef, useState } from "react";

interface MistralApiKeyDialogProps {
  onConfigure: () => void;
  onDismiss: () => void;
}

export function MistralApiKeyDialog({ onConfigure, onDismiss }: MistralApiKeyDialogProps) {
  const configureButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onConfigure();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    },
    [onConfigure, onDismiss],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    configureButtonRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-[400px] rounded-xl bg-elevated p-6 shadow-xl border border-border-subtle">
        <h3 className="text-lg font-semibold text-text-primary mb-3">Mistral API Key Required</h3>
        <p className="text-sm text-text-secondary mb-4">
          To use the Mistral Vibe agent, you need to configure your Mistral API key.
        </p>
        <p className="text-sm text-text-secondary mb-6">
          Get your API key from <a href="https://mistral.ai" className="text-accent hover:underline">mistral.ai</a>
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-md text-sm bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            ref={configureButtonRef}
            type="button"
            onClick={onConfigure}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-contrast hover:bg-accent/90 transition-colors"
          >
            Configure API Key
          </button>
        </div>
      </div>
    </div>
  );
}