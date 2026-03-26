import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createWorktree,
  generateWorktreePath,
  getDefaultBranch,
  listLocalBranches,
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

  it("uses custom base directory when provided", () => {
    const result = generateWorktreePath("/Users/dan/project", "feat-login", "/tmp/worktrees");
    expect(result).toBe("/tmp/worktrees/project--feat-login");
  });

  it("uses repo basename in custom base directory", () => {
    const result = generateWorktreePath("/Users/dan/my-app", "main", "/home/user/trees");
    expect(result).toBe("/home/user/trees/my-app--main");
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

  describe("getDefaultBranch", () => {
    it("returns the default branch name from a repo with a remote", () => {
      // Set up a bare remote so symbolic-ref works
      const bareRemote = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codez-wt-bare-")));
      execFileSync("git", ["clone", "--bare", repoDir, bareRemote]);
      // Point the local repo at the bare remote
      execFileSync("git", ["remote", "add", "origin", bareRemote], { cwd: repoDir });
      execFileSync("git", ["fetch", "origin"], { cwd: repoDir });

      const branch = getDefaultBranch(repoDir);
      expect(branch).toBe("main");

      fs.rmSync(bareRemote, { recursive: true, force: true });
    });

    it("falls back to 'main' when there is no remote", () => {
      const branch = getDefaultBranch(repoDir);
      expect(branch).toBe("main");
    });
  });

  describe("listLocalBranches", () => {
    it("returns the list of local branches", () => {
      const branches = listLocalBranches(repoDir);
      expect(branches).toContain("main");
    });

    it("includes branches created by worktrees", () => {
      createWorktree(repoDir, "feature-x");
      const branches = listLocalBranches(repoDir);
      expect(branches).toContain("main");
      expect(branches).toContain("feature-x");
    });
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

    it("creates worktree under custom base directory when provided", () => {
      const customBase = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codez-wt-custom-")));
      const worktreePath = createWorktree(repoDir, "custom-dir", customBase);
      const repoName = path.basename(repoDir);
      expect(worktreePath).toBe(path.join(customBase, `${repoName}--custom-dir`));
      expect(fs.existsSync(worktreePath)).toBe(true);
      expect(fs.existsSync(path.join(worktreePath, "README.md"))).toBe(true);
      // Cleanup
      fs.rmSync(customBase, { recursive: true, force: true });
    });

    it("creates worktree from a local baseBranch", () => {
      // Create a commit on main that the new branch should contain
      fs.writeFileSync(path.join(repoDir, "extra.txt"), "extra");
      execFileSync("git", ["add", "."], { cwd: repoDir });
      execFileSync("git", ["commit", "-m", "add extra"], { cwd: repoDir });

      const worktreePath = createWorktree({
        repoPath: repoDir,
        branchName: "from-main",
        baseBranch: "main",
      });
      expect(fs.existsSync(path.join(worktreePath, "extra.txt"))).toBe(true);
    });

    it("fetches and creates worktree from origin when fetchFirst is true", () => {
      // Set up a bare remote with an extra commit
      const bareRemote = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codez-wt-remote-")));
      execFileSync("git", ["clone", "--bare", repoDir, bareRemote]);
      execFileSync("git", ["remote", "add", "origin", bareRemote], { cwd: repoDir });
      execFileSync("git", ["fetch", "origin"], { cwd: repoDir });

      // Push a new commit directly to the bare remote via a temp clone
      const tempClone = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codez-wt-clone-")));
      execFileSync("git", ["clone", bareRemote, tempClone]);
      execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: tempClone });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: tempClone });
      fs.writeFileSync(path.join(tempClone, "remote-file.txt"), "from remote");
      execFileSync("git", ["add", "."], { cwd: tempClone });
      execFileSync("git", ["commit", "-m", "remote commit"], { cwd: tempClone });
      execFileSync("git", ["push"], { cwd: tempClone });

      // Now create worktree with fetchFirst — it should contain the remote commit
      const worktreePath = createWorktree({
        repoPath: repoDir,
        branchName: "fetched-branch",
        baseBranch: "main",
        fetchFirst: true,
      });
      expect(fs.existsSync(path.join(worktreePath, "remote-file.txt"))).toBe(true);

      fs.rmSync(bareRemote, { recursive: true, force: true });
      fs.rmSync(tempClone, { recursive: true, force: true });
    });

    it("throws when fetch fails with fetchFirst", () => {
      // No remote configured — fetch should fail
      expect(() =>
        createWorktree({
          repoPath: repoDir,
          branchName: "fail-fetch",
          baseBranch: "main",
          fetchFirst: true,
        }),
      ).toThrow("Failed to fetch");
    });

    it("accepts options object for basic usage", () => {
      const worktreePath = createWorktree({ repoPath: repoDir, branchName: "opts-test" });
      expect(fs.existsSync(worktreePath)).toBe(true);
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
