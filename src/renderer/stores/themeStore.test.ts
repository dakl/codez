import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_ID, getThemeById } from "../themes";
import { applyThemeToElement } from "./themeStore";

describe("applyThemeToElement", () => {
  it("sets all CSS custom properties on the given element", () => {
    const element = { style: { setProperty: vi.fn() } } as unknown as HTMLElement;
    const theme = getThemeById("midnight");

    applyThemeToElement(theme, element);

    for (const [key, value] of Object.entries(theme.colors)) {
      expect(element.style.setProperty).toHaveBeenCalledWith(`--color-${key}`, value);
    }
  });

  it("sets color-scheme to match theme mode", () => {
    const element = { style: { setProperty: vi.fn() } } as unknown as HTMLElement;
    const darkTheme = getThemeById("midnight");
    applyThemeToElement(darkTheme, element);
    expect(element.style.setProperty).toHaveBeenCalledWith("color-scheme", "dark");

    const lightTheme = getThemeById("snow");
    applyThemeToElement(lightTheme, element);
    expect(element.style.setProperty).toHaveBeenCalledWith("color-scheme", "light");
  });
});

describe("themeStore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("initializes with default theme id and settings closed", async () => {
    const { useThemeStore } = await import("./themeStore");
    const state = useThemeStore.getState();
    expect(state.activeThemeId).toBe(DEFAULT_THEME_ID);
    expect(state.settingsOpen).toBe(false);
  });

  it("toggleSettings flips the settings panel state", async () => {
    const { useThemeStore } = await import("./themeStore");
    expect(useThemeStore.getState().settingsOpen).toBe(false);
    useThemeStore.getState().toggleSettings();
    expect(useThemeStore.getState().settingsOpen).toBe(true);
    useThemeStore.getState().toggleSettings();
    expect(useThemeStore.getState().settingsOpen).toBe(false);
  });

  it("closeSettings sets settingsOpen to false", async () => {
    const { useThemeStore } = await import("./themeStore");
    useThemeStore.getState().toggleSettings();
    expect(useThemeStore.getState().settingsOpen).toBe(true);
    useThemeStore.getState().closeSettings();
    expect(useThemeStore.getState().settingsOpen).toBe(false);
  });

  it("setTheme updates activeThemeId and calls saveSettings", async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      electronAPI: { saveSettings: saveMock },
      document: { documentElement: { style: { setProperty: vi.fn() } } },
    });

    const { useThemeStore } = await import("./themeStore");
    useThemeStore.getState().setTheme("ember");

    expect(useThemeStore.getState().activeThemeId).toBe("ember");
    expect(saveMock).toHaveBeenCalledWith({ theme: "ember" });
  });

  it("loadTheme reads theme from settings API", async () => {
    const getMock = vi.fn().mockResolvedValue({ theme: "forest" });
    const element = { style: { setProperty: vi.fn() } };
    vi.stubGlobal("window", {
      electronAPI: { getSettings: getMock },
      document: { documentElement: element },
    });

    const { useThemeStore } = await import("./themeStore");
    await useThemeStore.getState().loadTheme();

    expect(useThemeStore.getState().activeThemeId).toBe("forest");
  });

  it("loadTheme keeps default when settings has no theme", async () => {
    const getMock = vi.fn().mockResolvedValue({});
    const element = { style: { setProperty: vi.fn() } };
    vi.stubGlobal("window", {
      electronAPI: { getSettings: getMock },
      document: { documentElement: element },
    });

    const { useThemeStore } = await import("./themeStore");
    await useThemeStore.getState().loadTheme();

    expect(useThemeStore.getState().activeThemeId).toBe(DEFAULT_THEME_ID);
  });
});
