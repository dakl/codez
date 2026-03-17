import { execFileSync } from "node:child_process";

export function sanitizeBranchName(name: string): string {
  return name
    .trim()
    .replace(/[\s/]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateWorktreePath(repoPath: string, branchName: string): string {
  const safeName = sanitizeBranchName(branchName);
  return `${repoPath}--${safeName}`;
}

export function createWorktree(repoPath: string, branchName: string): string {
  const safeName = sanitizeBranchName(branchName);
  const worktreePath = generateWorktreePath(repoPath, safeName);

  try {
    execFileSync("git", ["worktree", "add", worktreePath, "-b", safeName], {
      cwd: repoPath,
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

  return worktreePath;
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
