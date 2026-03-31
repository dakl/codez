import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function getDefaultBranch(repoPath: string): string {
  try {
    const ref = execFileSync("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 5000,
    }).trim();
    // "refs/remotes/origin/main" → "main"
    const parts = ref.split("/");
    return parts[parts.length - 1];
  } catch {
    // No remote or symbolic-ref not set — fall back to "main"
    return "main";
  }
}

export function listLocalBranches(repoPath: string): string[] {
  const output = execFileSync("git", ["branch", "--format=%(refname:short)"], {
    cwd: repoPath,
    encoding: "utf8",
    stdio: "pipe",
    timeout: 5000,
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function sanitizeBranchName(name: string): string {
  return name
    .trim()
    .replace(/[\s/]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateWorktreePath(repoPath: string, branchName: string, baseDir?: string): string {
  const safeName = sanitizeBranchName(branchName);
  if (baseDir) {
    const repoName = path.basename(repoPath);
    return path.join(baseDir, `${repoName}--${safeName}`);
  }
  return `${repoPath}--${safeName}`;
}

export interface CreateWorktreeOptions {
  repoPath: string;
  branchName: string;
  baseDir?: string;
  baseBranch?: string;
  fetchFirst?: boolean;
}

export function createWorktree(options: CreateWorktreeOptions): string;
export function createWorktree(repoPath: string, branchName: string, baseDir?: string): string;
export function createWorktree(
  optionsOrRepoPath: CreateWorktreeOptions | string,
  branchName?: string,
  baseDir?: string,
): string {
  const options: CreateWorktreeOptions =
    typeof optionsOrRepoPath === "string"
      ? { repoPath: optionsOrRepoPath, branchName: branchName ?? "", baseDir }
      : optionsOrRepoPath;

  const safeName = sanitizeBranchName(options.branchName);
  const worktreePath = generateWorktreePath(options.repoPath, safeName, options.baseDir);

  if (options.fetchFirst && options.baseBranch) {
    try {
      execFileSync("git", ["fetch", "origin", options.baseBranch], {
        cwd: options.repoPath,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 30000,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch origin/${options.baseBranch}: ${message}`);
    }
  }

  const startPoint = options.baseBranch
    ? options.fetchFirst
      ? `origin/${options.baseBranch}`
      : options.baseBranch
    : undefined;

  const args = ["worktree", "add", worktreePath, "-b", safeName];
  if (startPoint) {
    args.push(startPoint);
  }

  try {
    execFileSync("git", args, {
      cwd: options.repoPath,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already exists")) {
      throw new Error(`Branch "${safeName}" already exists`);
    }
    throw new Error(`Failed to create worktree: ${message}`);
  }

  linkClaudeSettings(options.repoPath, worktreePath);

  return worktreePath;
}

/**
 * Symlink settings.local.json from the main repo into a worktree so tool
 * permissions are shared, while leaving .claude/ as a real directory so git
 * stash and normal git operations work without issues.
 */
export function linkClaudeSettings(repoPath: string, worktreePath: string): void {
  const sourceSettingsJson = path.join(repoPath, ".claude", "settings.local.json");
  if (!fs.existsSync(sourceSettingsJson)) return;

  const worktreeClaudeDir = path.join(worktreePath, ".claude");

  // Migrate from old behaviour: .claude/ was a directory symlink.
  // Remove it and restore any tracked files so .claude/ becomes a real directory.
  try {
    const stat = fs.lstatSync(worktreeClaudeDir);
    if (stat.isSymbolicLink()) {
      fs.rmSync(worktreeClaudeDir);
      try {
        execFileSync("git", ["checkout", "--", ".claude"], {
          cwd: worktreePath,
          encoding: "utf8",
          stdio: "pipe",
        });
      } catch {
        // .claude is not tracked — just recreate the directory
        fs.mkdirSync(worktreeClaudeDir);
      }
    }
    // else: already a real directory — nothing to do
  } catch {
    // lstatSync threw — path doesn't exist, create the directory
    fs.mkdirSync(worktreeClaudeDir);
  }

  // Symlink settings.local.json if it isn't already there
  const targetSettingsJson = path.join(worktreeClaudeDir, "settings.local.json");
  try {
    fs.lstatSync(targetSettingsJson);
    // Already exists (real file or symlink) — leave it alone
  } catch {
    fs.symlinkSync(sourceSettingsJson, targetSettingsJson);
  }
}

export function removeWorktree(worktreePath: string, branchName: string, repoPath: string): void {
  // Remove the worktree (force in case of uncommitted changes)
  try {
    execFileSync("git", ["worktree", "remove", "--force", worktreePath], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch {
    // Worktree may already be gone — prune stale entries
    try {
      execFileSync("git", ["worktree", "prune"], { cwd: repoPath, stdio: "pipe" });
    } catch {
      // best effort
    }
  }

  // Delete the branch
  const safeName = sanitizeBranchName(branchName);
  try {
    execFileSync("git", ["branch", "-D", safeName], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch {
    // Branch may not exist — log but don't throw
  }
}

export function listWorktrees(repoPath: string): string[] {
  const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoPath,
    encoding: "utf8",
    stdio: "pipe",
  });

  const paths: string[] = [];
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      paths.push(line.slice("worktree ".length));
    }
  }
  return paths;
}
