interface WorktreeDeleteDialogProps {
  branchName: string;
  context: "archive" | "delete";
  onDeleteBranch: () => void;
  onKeepBranch: () => void;
  onCancel: () => void;
}

export function WorktreeDeleteDialog({
  branchName,
  context,
  onDeleteBranch,
  onKeepBranch,
  onCancel,
}: WorktreeDeleteDialogProps) {
  const title = context === "archive" ? "Archive session" : "Delete session";
  const keepLabel = context === "archive" ? "Keep worktree" : "Keep branch";
  const deleteLabel = context === "archive" ? "Delete worktree & branch" : "Delete worktree & branch";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-elevated border border-border rounded-xl p-4 w-72 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium text-text-primary mb-1">{title}</div>
        <div className="text-[11px] text-text-muted mb-3">
          This session uses branch <span className="font-mono text-text-secondary">{branchName}</span>. What should
          happen to the worktree?
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onKeepBranch}
            className="w-full px-3 py-1.5 text-[11px] text-left bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors rounded-lg"
          >
            {keepLabel}
          </button>
          <button
            type="button"
            onClick={onDeleteBranch}
            className="w-full px-3 py-1.5 text-[11px] text-left bg-error-muted hover:bg-error/20 text-error transition-colors rounded-lg"
          >
            {deleteLabel}
          </button>
        </div>

        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-[11px] text-text-muted hover:text-text-primary transition-colors rounded-md"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
