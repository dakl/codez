import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron before importing the module under test
vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    dock: { setIcon: vi.fn() },
  },
}));

import { app } from "electron";
import { applyDockIcon, getIconsDir } from "./dock";

describe("getIconsDir", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns resources/ relative to project root in dev mode", () => {
    Object.defineProperty(app, "isPackaged", { value: false, configurable: true });
    const iconsDir = getIconsDir();
    expect(iconsDir).toMatch(/resources$/);
    expect(path.isAbsolute(iconsDir)).toBe(true);
  });

  it("returns resourcesPath/icons in packaged mode", () => {
    Object.defineProperty(app, "isPackaged", { value: true, configurable: true });
    const originalResourcesPath = process.resourcesPath;
    Object.defineProperty(process, "resourcesPath", {
      value: "/Applications/Codez.app/Contents/Resources",
      configurable: true,
    });

    const iconsDir = getIconsDir();
    expect(iconsDir).toBe("/Applications/Codez.app/Contents/Resources/icons");

    Object.defineProperty(process, "resourcesPath", {
      value: originalResourcesPath,
      configurable: true,
    });
  });
});

describe("applyDockIcon", () => {
  beforeEach(() => {
    vi.mocked(app.dock?.setIcon).mockClear();
  });

  it("calls app.dock.setIcon with the correct PNG path", () => {
    Object.defineProperty(app, "isPackaged", { value: false, configurable: true });
    applyDockIcon("icon-03");
    expect(app.dock?.setIcon).toHaveBeenCalledOnce();
    const calledPath = vi.mocked(app.dock?.setIcon).mock.calls[0][0] as string;
    expect(calledPath).toContain("icon-03.png");
    expect(path.isAbsolute(calledPath)).toBe(true);
  });

  it("defaults to icon-01 when no iconId is provided", () => {
    Object.defineProperty(app, "isPackaged", { value: false, configurable: true });
    applyDockIcon();
    const calledPath = vi.mocked(app.dock?.setIcon).mock.calls[0][0] as string;
    expect(calledPath).toContain("icon-01.png");
  });
});
