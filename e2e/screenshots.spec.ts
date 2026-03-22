/**
 * Playwright script to capture Codez app screenshots for the website.
 *
 * Usage:
 *   npm run screenshots
 *
 * Output:
 *   website/public/screenshots/app.png
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { test } from "@playwright/test";

const OUTPUT_DIR = path.join(__dirname, "..", "website", "public", "screenshots");
const WINDOW_WIDTH = 1200;
const WINDOW_HEIGHT = 800;

function createGitRepo(dirName: string): string {
  const sandboxDir = mkdtempSync(path.join(tmpdir(), "codez-ss-"));
  const repoDir = path.join(sandboxDir, dirName);
  mkdirSync(repoDir);

  execSync(
    [
      "git init",
      "git checkout -b main",
      'git config user.email "dk@example.com"',
      'git config user.name "Daniel Klevebring"',
      `echo "# ${dirName}" > README.md`,
      "git add .",
      'git commit -m "Initial commit"',
      "echo 'src/' >> .gitignore",
      "git add .",
      'git commit -m "Add gitignore"',
    ].join(" && "),
    { cwd: repoDir, stdio: "ignore" },
  );

  // Pre-trust the folder so Claude skips the trust prompt
  const claudeDir = path.join(repoDir, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({ permissions: { allow: ["*"] } }),
  );
  execSync("git add -A && git commit -m 'Add claude config'", {
    cwd: repoDir,
    stdio: "ignore",
  });

  return repoDir;
}

test("capture app screenshot", async () => {
  test.setTimeout(90_000);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const dataDir = mkdtempSync(path.join(tmpdir(), "codez-screenshots-"));

  console.log("Creating git repos...");
  const codezRepo = createGitRepo("codez");
  const papershelfRepo = createGitRepo("papershelf");
  console.log(`  codez: ${codezRepo}`);
  console.log(`  papershelf: ${papershelfRepo}`);

  console.log("Launching Electron app...");
  const app = await electron.launch({
    args: [path.join(__dirname, "..", "dist", "main", "main", "index.js")],
    env: { ...process.env, E2E_TEST: "true", E2E_DATA_DIR: dataDir },
  });

  const window = await app.firstWindow();
  console.log("Window ready");

  // Resize to consistent dimensions
  await app.evaluate(
    ({ BrowserWindow }, { width, height }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setSize(width, height);
      win.center();
    },
    { width: WINDOW_WIDTH, height: WINDOW_HEIGHT },
  );

  // Add repos
  console.log("Adding repos...");
  await window.evaluate(
    async ([codez, papershelf]) => {
      const api = (window as any).electronAPI;
      await api.addRepo(codez);
      await api.addRepo(papershelf);
    },
    [codezRepo, papershelfRepo],
  );
  console.log("Repos added");

  // Create sessions one at a time for better error visibility
  console.log("Creating session 1: codez on main...");
  await window.evaluate(
    async ([repo]) => {
      await (window as any).electronAPI.createSession(repo, "claude", "", "Parallel session manager");
    },
    [codezRepo],
  );
  console.log("Session 1 created");

  console.log("Creating session 2: codez on custom-fonts...");
  await window.evaluate(
    async ([repo]) => {
      await (window as any).electronAPI.createSession(repo, "claude", "custom-fonts", "Custom font integration");
    },
    [codezRepo],
  );
  console.log("Session 2 created");

  console.log("Creating session 3: papershelf on v3.0-dev...");
  await window.evaluate(
    async ([repo]) => {
      await (window as any).electronAPI.createSession(repo, "claude", "v3.0-dev", "Migrate to React 19");
    },
    [papershelfRepo],
  );
  console.log("Session 3 created");

  // Set Sand theme before reload so it's applied on load
  console.log("Setting Sand theme...");
  await window.evaluate(async () => {
    await (window as any).electronAPI.saveSettings({ theme: "sand" });
  });

  // Reload to pick up sessions + theme
  console.log("Reloading UI...");
  await window.evaluate(() => location.reload());
  await window.waitForTimeout(1500);

  // Let the UI finish rendering (don't select a session — avoids leaking
  // terminal output with paths, version numbers, and personal info)
  await window.waitForTimeout(500);

  const screenshotPath = path.join(OUTPUT_DIR, "app.png");
  await window.screenshot({ path: screenshotPath });
  console.log(`Saved: ${screenshotPath}`);

  await app.close();
});
