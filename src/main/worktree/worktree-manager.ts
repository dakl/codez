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

  symlinkClaudeDir(options.repoPath, worktreePath);

  return worktreePath;
}

/** Symlink .claude/ from the main repo into a worktree so permissions are shared */
export function symlinkClaudeDir(repoPath: string, worktreePath: string): void {
  const sourceClaudeDir = path.join(repoPath, ".claude");
  if (!fs.existsSync(sourceClaudeDir)) return;

  const targetClaudeDir = path.join(worktreePath, ".claude");

  // If .claude already exists in the worktree (e.g. tracked by git),
  // remove it first so we can replace it with a symlink
  if (fs.existsSync(targetClaudeDir)) {
    const stat = fs.lstatSync(targetClaudeDir);
    if (stat.isSymbolicLink()) return; // already a symlink — nothing to do
    fs.rmSync(targetClaudeDir, { recursive: true, force: true });
  }

  fs.symlinkSync(sourceClaudeDir, targetClaudeDir);
  excludeClaudeDir(worktreePath);

  // Remove .claude from the worktree's index so git doesn't see
  // tracked-file deletions after replacing the directory with a symlink.
  // This only affects the worktree's index, not the main repo.
  try {
    execFileSync("git", ["rm", "--cached", "-r", "--quiet", ".claude"], {
      cwd: worktreePath,
      stdio: "pipe",
    });
  } catch {
    // .claude may not be tracked — ignore
  }
}

/** Add .claude to the worktree's git exclude file so git ignores the symlink.
 *  Git worktrees read info/exclude from the common git dir (the main repo's .git/). */
export function excludeClaudeDir(worktreePath: string): void {
  let commonDir: string;
  try {
    commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: worktreePath,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    return;
  }

  // Resolve relative paths (git may return a relative path)
  if (!path.isAbsolute(commonDir)) {
    commonDir = path.resolve(worktreePath, commonDir);
  }

  const infoDir = path.join(commonDir, "info");
  fs.mkdirSync(infoDir, { recursive: true });

  const excludeFile = path.join(infoDir, "exclude");
  const existingContent = fs.existsSync(excludeFile) ? fs.readFileSync(excludeFile, "utf8") : "";

  if (existingContent.split("\n").some((line) => line.trim() === ".claude")) return;

  const separator = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(excludeFile, `${separator}.claude\n`);
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
