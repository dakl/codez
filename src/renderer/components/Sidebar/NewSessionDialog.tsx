import { useCallback, useEffect, useRef, useState } from "react";

interface NewSessionDialogProps {
  repoName: string;
  repoPath: string;
  onConfirm: (options: { branchName?: string; baseBranch?: string; fetchFirst?: boolean }) => void | Promise<void>;
  onCancel: () => void;
}

export function NewSessionDialog({ repoName, repoPath, onConfirm, onCancel }: NewSessionDialogProps) {
  const [branchName, setBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [branches, setBranches] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState<string>("main");
  const [baseBranch, setBaseBranch] = useState<string>("");
  const [fetchFirst, setFetchFirst] = useState(true);

  useEffect(() => {
    Promise.all([window.electronAPI.listBranches(repoPath), window.electronAPI.getDefaultBranch(repoPath)]).then(
      ([branchList, detectedDefault]) => {
        setBranches(branchList);
        setDefaultBranch(detectedDefault);
        setBaseBranch(detectedDefault);
      },
    );
  }, [repoPath]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmed = branchName.trim();

    if (!trimmed) {
      onConfirm({});
      return;
    }

    setLoading(true);
    try {
      await onConfirm({ branchName: trimmed, baseBranch, fetchFirst });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchName, baseBranch, fetchFirst, onConfirm]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  const showBranchOptions = branchName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-elevated border border-border rounded-xl p-4 w-72 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="text-sm font-medium text-text-primary mb-1">New session in {repoName}</div>
        <div className="text-[11px] text-text-muted mb-3">Leave empty to use the repo directly.</div>

        <input
          ref={inputRef}
          type="text"
          value={branchName}
          onChange={(e) => {
            setBranchName(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Branch name (optional)"
          autoFocus
          disabled={loading}
          className="w-full px-3 py-1.5 bg-input border border-border rounded-lg text-[13px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
        />

        {showBranchOptions && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="text-[11px] text-text-muted block mb-1">Base branch</label>
              <select
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                disabled={loading}
                className="w-full px-2 py-1 bg-input border border-border rounded-lg text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                    {branch === defaultBranch ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-[11px] text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={fetchFirst}
                onChange={(e) => setFetchFirst(e.target.checked)}
                disabled={loading}
                className="rounded border-border accent-accent"
              />
              Fetch latest from origin
            </label>
          </div>
        )}

        {error && <div className="mt-2 text-[11px] text-error">{error}</div>}

        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1 text-[11px] text-text-muted hover:text-text-primary transition-colors rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-3 py-1 text-[11px] bg-accent/20 text-accent hover:bg-accent/30 transition-colors rounded-md"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
