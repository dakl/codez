import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { _electron as electron, type ElectronApplication } from "@playwright/test";
import { expect, test } from "@playwright/test";

let app: ElectronApplication;
let dataDir: string;

test.beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "codez-e2e-"));
  app = await electron.launch({
    args: [path.join(__dirname, "..", "dist", "main", "main", "index.js")],
    env: { ...process.env, E2E_TEST: "true", E2E_DATA_DIR: dataDir },
  });
});

test.afterEach(async () => {
  await app.close();
});

test("app launches and shows main window", async () => {
  const window = await app.firstWindow();
  const title = await window.title();
  expect(title).toBe("Codez");
});

test("empty state shows Codez heading and shortcut hint", async () => {
  const window = await app.firstWindow();
  await expect(window.locator("h1")).toContainText("Codez");
  await expect(window.locator("text=Press")).toBeVisible();
});

test("sidebar shows add folder prompt when no repos exist", async () => {
  const window = await app.firstWindow();
  await expect(
    window.locator("text=Add a folder to get started"),
  ).toBeVisible();
});
