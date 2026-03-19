import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createWorktree,
  generateWorktreePath,
  listWorktrees,
  removeWorktree,
  sanitizeBranchName,
} from "./worktree-manager";

describe("sanitizeBranchName", () => {
  it("replaces slashes with hyphens", () => {
    expect(sanitizeBranchName("feat/login")).toBe("feat-login");
  });

  it("strips leading/trailing whitespace", () => {
    expect(sanitizeBranchName("  my-branch  ")).toBe("my-branch");
  });

  it("replaces spaces with hyphens", () => {
    expect(sanitizeBranchName("my cool branch")).toBe("my-cool-branch");
  });

  it("collapses multiple hyphens", () => {
    expect(sanitizeBranchName("feat//double")).toBe("feat-double");
  });

  it("strips leading/trailing hyphens", () => {
    expect(sanitizeBranchName("-leading-trailing-")).toBe("leading-trailing");
  });

  it("handles complex names", () => {
    expect(sanitizeBranchName("  feat/my cool / branch  ")).toBe("feat-my-cool-branch");
  });
});

describe("generateWorktreePath", () => {
  it("creates sibling path with branch suffix", () => {
    const result = generateWorktreePath("/Users/dan/project", "feat-login");
    expect(result).toBe("/Users/dan/project--feat-login");
  });

  it("sanitizes the branch name", () => {
    const result = generateWorktreePath("/Users/dan/project", "feat/login");
    expect(result).toBe("/Users/dan/project--feat-login");
  });
});

describe("worktree operations", () => {
  let repoDir: string;

  beforeEach(() => {
    // fs.realpathSync resolves /var → /private/var on macOS
    repoDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codez-wt-test-")));
    execFileSync("git", ["init", "--initial-branch", "main"], { cwd: repoDir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: repoDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoDir });
    fs.writeFileSync(path.join(repoDir, "README.md"), "hello");
    execFileSync("git", ["add", "."], { cwd: repoDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: repoDir });
  });

  afterEach(() => {
    // Clean up worktrees before removing the repo
    try {
      const worktrees = listWorktrees(repoDir);
      for (const worktreePath of worktrees) {
        if (worktreePath !== repoDir) {
          execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: repoDir });
        }
      }
    } catch {
      // best effort
    }
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  describe("createWorktree", () => {
    it("creates a worktree and returns its path", () => {
      const worktreePath = createWorktree(repoDir, "test-branch");
      expect(fs.existsSync(worktreePath)).toBe(true);
      expect(fs.existsSync(path.join(worktreePath, "README.md"))).toBe(true);
    });

    it("creates a new branch in the worktree", () => {
      createWorktree(repoDir, "new-feature");
      const branches = execFileSync("git", ["branch", "--list"], { cwd: repoDir, encoding: "utf8" });
      expect(branches).toContain("new-feature");
    });

    it("throws when branch already exists", () => {
      createWorktree(repoDir, "existing-branch");
      expect(() => createWorktree(repoDir, "existing-branch")).toThrow();
    });

    it("symlinks .claude directory from main repo into worktree", () => {
      const claudeDir = path.join(repoDir, ".claude");
      fs.mkdirSync(claudeDir);
      fs.writeFileSync(path.join(claudeDir, "settings.local.json"), '{"permissions":{}}');

      const worktreePath = createWorktree(repoDir, "with-claude");
      const worktreeClaudeDir = path.join(worktreePath, ".claude");

      expect(fs.lstatSync(worktreeClaudeDir).isSymbolicLink()).toBe(true);
      expect(fs.realpathSync(worktreeClaudeDir)).toBe(claudeDir);
      // Permissions file is accessible through the symlink
      expect(fs.existsSync(path.join(worktreeClaudeDir, "settings.local.json"))).toBe(true);
    });

    it("replaces tracked .claude directory with symlink when .claude is committed", () => {
      // .claude/ is tracked by git — git worktree add copies it into the worktree
      const claudeDir = path.join(repoDir, ".claude");
      fs.mkdirSync(claudeDir);
      fs.writeFileSync(path.join(claudeDir, "settings.local.json"), '{"permissions":{}}');
      execFileSync("git", ["add", ".claude"], { cwd: repoDir });
      execFileSync("git", ["commit", "-m", "add .claude"], { cwd: repoDir });

      const worktreePath = createWorktree(repoDir, "tracked-claude");
      const worktreeClaudeDir = path.join(worktreePath, ".claude");

      // Should be a symlink, not a copied directory
      expect(fs.lstatSync(worktreeClaudeDir).isSymbolicLink()).toBe(true);
      expect(fs.realpathSync(worktreeClaudeDir)).toBe(claudeDir);
    });

    it("skips symlink when main repo has no .claude directory", () => {
      const worktreePath = createWorktree(repoDir, "no-claude");
      expect(fs.existsSync(path.join(worktreePath, ".claude"))).toBe(false);
    });
  });

  describe("removeWorktree", () => {
    it("removes the worktree directory and deletes the branch", () => {
      const worktreePath = createWorktree(repoDir, "to-remove");
      removeWorktree(worktreePath, "to-remove", repoDir);
      expect(fs.existsSync(worktreePath)).toBe(false);
      const branches = execFileSync("git", ["branch", "--list"], { cwd: repoDir, encoding: "utf8" });
      expect(branches).not.toContain("to-remove");
    });

    it("does not throw when worktree is already gone", () => {
      const worktreePath = generateWorktreePath(repoDir, "ghost");
      expect(() => removeWorktree(worktreePath, "ghost", repoDir)).not.toThrow();
    });

    it("still removes the branch if worktree dir was manually deleted", () => {
      const worktreePath = createWorktree(repoDir, "partial-cleanup");
      fs.rmSync(worktreePath, { recursive: true, force: true });
      removeWorktree(worktreePath, "partial-cleanup", repoDir);
      const branches = execFileSync("git", ["branch", "--list"], { cwd: repoDir, encoding: "utf8" });
      expect(branches).not.toContain("partial-cleanup");
    });
  });

  describe("listWorktrees", () => {
    it("returns the main worktree when no extras exist", () => {
      const worktrees = listWorktrees(repoDir);
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]).toBe(repoDir);
    });

    it("includes created worktrees", () => {
      createWorktree(repoDir, "wt-list-test");
      const worktrees = listWorktrees(repoDir);
      expect(worktrees).toHaveLength(2);
    });
  });
});
