import type { PermissionRequestData } from "@shared/agent-types";
import { useCallback, useEffect, useRef } from "react";

interface PermissionDialogProps {
  permission: PermissionRequestData;
  onApprove: () => void;
  onDeny: () => void;
}

function formatToolInput(toolName: string, toolInput: Record<string, unknown>): string {
  if (toolName === "Bash" && typeof toolInput.command === "string") {
    return toolInput.command;
  }
  if (toolName === "Edit" && typeof toolInput.file_path === "string") {
    return `Edit ${toolInput.file_path}`;
  }
  if (toolName === "Write" && typeof toolInput.file_path === "string") {
    return `Write ${toolInput.file_path}`;
  }
  return JSON.stringify(toolInput, null, 2);
}

export function PermissionDialog({ permission, onApprove, onDeny }: PermissionDialogProps) {
  const allowButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onApprove();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onDeny();
      }
    },
    [onApprove, onDeny],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    allowButtonRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const displayInput = formatToolInput(permission.toolName, permission.toolInput);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-[480px] rounded-xl bg-elevated p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-text-primary mb-1">Permission requested</h3>
        <p className="text-xs text-text-muted mb-3">
          Agent wants to use <span className="font-medium text-text-secondary">{permission.toolName}</span>
        </p>

        <pre className="rounded-lg bg-surface p-3 text-xs text-text-secondary overflow-x-auto max-h-48 overflow-y-auto mb-4 font-mono whitespace-pre-wrap break-words">
          {displayInput}
        </pre>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDeny}
            title="Deny (Esc)"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
          >
            Deny
          </button>
          <button
            ref={allowButtonRef}
            type="button"
            onClick={onApprove}
            title="Allow (↵)"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
