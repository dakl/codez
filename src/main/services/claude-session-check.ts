import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Compute the directory hash Claude Code uses for project-scoped session storage.
 * Claude replaces all `/` in the resolved absolute path with `-`.
 *
 * Example: /Users/daniel/dev/myproject → -Users-daniel-dev-myproject
 *
 * Note: on macOS, realpathSync resolves /var → /private/var, which matches
 * what Claude Code does internally.
 */
export function computeClaudeProjectHash(worktreePath: string): string {
  let resolved: string;
  try {
    resolved = realpathSync(worktreePath);
  } catch {
    // Path doesn't exist (yet) — use as-is
    resolved = worktreePath;
  }
  return resolved.replace(/\//g, "-");
}

/**
 * Check if a Claude Code session file exists on disk.
 *
 * Claude stores sessions at:
 *   ~/.claude/projects/{path-hash}/{session-id}.jsonl
 *
 * This is used to validate that --resume will succeed before spawning
 * an interactive PTY. In interactive mode, --resume silently falls back
 * to the most recent session if the target doesn't exist (unlike -p mode
 * which properly errors).
 *
 * @param claudeDir - Override for ~/.claude (used in tests)
 */
export function claudeSessionExistsOnDisk(worktreePath: string, sessionId: string, claudeDir?: string): boolean {
  const baseDir = claudeDir ?? join(homedir(), ".claude");
  const projectHash = computeClaudeProjectHash(worktreePath);
  const sessionFile = join(baseDir, "projects", projectHash, `${sessionId}.jsonl`);
  return existsSync(sessionFile);
}
