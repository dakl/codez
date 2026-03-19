import { execSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { _electron as electron, type ElectronApplication } from "@playwright/test";
import { expect, test } from "@playwright/test";

let app: ElectronApplication;
let dataDir: string;
let repoDir: string;

test.beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "codez-e2e-"));

  // Create a temp git repo with an initial commit
  repoDir = mkdtempSync(path.join(tmpdir(), "codez-e2e-repo-"));
  execSync("git init && git commit --allow-empty -m 'init'", {
    cwd: repoDir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@test.com",
    },
  });

  app = await electron.launch({
    args: [path.join(__dirname, "..", "dist", "main", "main", "index.js")],
    env: { ...process.env, E2E_TEST: "true", E2E_DATA_DIR: dataDir },
  });
});

test.afterEach(async () => {
  await app.close();
});

test("creating a session with a branch name creates a worktree on disk", async () => {
  const window = await app.firstWindow();

  // Add the temp repo and create a session with a branch via the preload bridge
  await window.evaluate(
    async ([repoPath]) => {
      await (window as any).electronAPI.addRepo(repoPath);
      await (window as any).electronAPI.createSession(
        repoPath,
        "claude",
        "test-branch",
      );
    },
    [repoDir],
  );

  // Worktree should exist at <repoDir>--test-branch
  const worktreePath = `${repoDir}--test-branch`;
  expect(existsSync(worktreePath)).toBe(true);

  // Verify it's a valid git worktree
  const worktreeList = execSync("git worktree list", {
    cwd: repoDir,
    encoding: "utf-8",
  });
  expect(worktreeList).toContain("test-branch");
});

test("creating a session without a branch uses the repo directly", async () => {
  const window = await app.firstWindow();

  const session = await window.evaluate(
    async ([repoPath]) => {
      await (window as any).electronAPI.addRepo(repoPath);
      return await (window as any).electronAPI.createSession(
        repoPath,
        "claude",
      );
    },
    [repoDir],
  );

  // Session worktreePath should equal the repo path (no worktree created)
  expect((session as any).worktreePath).toBe(repoDir);
});
