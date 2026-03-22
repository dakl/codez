import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFontsToElement,
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_FONT_SIZE_MONO,
  DEFAULT_TERMINAL_LINE_HEIGHT,
} from "./fontStore";

describe("applyFontsToElement", () => {
  it("sets --font-sans and --font-mono CSS custom properties", () => {
    const element = { style: { setProperty: vi.fn() } } as unknown as HTMLElement;

    applyFontsToElement("Inter", "Fira Code", element);

    expect(element.style.setProperty).toHaveBeenCalledWith(
      "--font-sans",
      '"Inter", ui-sans-serif, system-ui, sans-serif',
    );
    expect(element.style.setProperty).toHaveBeenCalledWith("--font-mono", '"Fira Code", ui-monospace, monospace');
  });

  it("uses default fallback chains for bundled fonts", () => {
    const element = { style: { setProperty: vi.fn() } } as unknown as HTMLElement;

    applyFontsToElement("Geist", "Geist Mono", element);

    expect(element.style.setProperty).toHaveBeenCalledWith(
      "--font-sans",
      '"Geist", ui-sans-serif, system-ui, sans-serif',
    );
    expect(element.style.setProperty).toHaveBeenCalledWith("--font-mono", '"Geist Mono", ui-monospace, monospace');
  });
});

describe("fontStore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("initializes with default font values", async () => {
    const { useFontStore } = await import("./fontStore");
    const state = useFontStore.getState();
    expect(state.fontSans).toBe(DEFAULT_FONT_SANS);
    expect(state.fontMono).toBe(DEFAULT_FONT_MONO);
  });

  it("setFontSans updates state and calls saveSettings", async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      electronAPI: { saveSettings: saveMock },
      document: { documentElement: { style: { setProperty: vi.fn() } } },
    });

    const { useFontStore } = await import("./fontStore");
    useFontStore.getState().setFontSans("Inter");

    expect(useFontStore.getState().fontSans).toBe("Inter");
    expect(saveMock).toHaveBeenCalledWith({ fontSans: "Inter" });
  });

  it("setFontMono updates state and calls saveSettings", async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      electronAPI: { saveSettings: saveMock },
      document: { documentElement: { style: { setProperty: vi.fn() } } },
    });

    const { useFontStore } = await import("./fontStore");
    useFontStore.getState().setFontMono("JetBrains Mono");

    expect(useFontStore.getState().fontMono).toBe("JetBrains Mono");
    expect(saveMock).toHaveBeenCalledWith({ fontMono: "JetBrains Mono" });
  });

  it("loadFonts reads fonts from settings API", async () => {
    const getMock = vi.fn().mockResolvedValue({ fontSans: "Inter", fontMono: "Fira Code" });
    const element = { style: { setProperty: vi.fn() } };
    vi.stubGlobal("window", {
      electronAPI: { getSettings: getMock },
      document: { documentElement: element },
    });

    const { useFontStore } = await import("./fontStore");
    await useFontStore.getState().loadFonts();

    expect(useFontStore.getState().fontSans).toBe("Inter");
    expect(useFontStore.getState().fontMono).toBe("Fira Code");
  });

  it("loadFonts keeps defaults when settings has no font values", async () => {
    const getMock = vi.fn().mockResolvedValue({});
    const element = { style: { setProperty: vi.fn() } };
    vi.stubGlobal("window", {
      electronAPI: { getSettings: getMock },
      document: { documentElement: element },
    });

    const { useFontStore } = await import("./fontStore");
    await useFontStore.getState().loadFonts();

    expect(useFontStore.getState().fontSans).toBe(DEFAULT_FONT_SANS);
    expect(useFontStore.getState().fontMono).toBe(DEFAULT_FONT_MONO);
  });

  it("setFontSans applies CSS custom properties to document", async () => {
    const setProperty = vi.fn();
    vi.stubGlobal("window", {
      electronAPI: { saveSettings: vi.fn().mockResolvedValue(undefined) },
      document: { documentElement: { style: { setProperty } } },
    });

    const { useFontStore } = await import("./fontStore");
    useFontStore.getState().setFontSans("Helvetica");

    expect(setProperty).toHaveBeenCalledWith("--font-sans", '"Helvetica", ui-sans-serif, system-ui, sans-serif');
  });

  it("initializes with default font size and line height values", async () => {
    const { useFontStore } = await import("./fontStore");
    const state = useFontStore.getState();
    expect(state.fontSizeMono).toBe(DEFAULT_FONT_SIZE_MONO);
    expect(state.terminalLineHeight).toBe(DEFAULT_TERMINAL_LINE_HEIGHT);
  });

  it("setFontSizeMono updates state and calls saveSettings", async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      electronAPI: { saveSettings: saveMock },
      document: { documentElement: { style: { setProperty: vi.fn() } } },
    });

    const { useFontStore } = await import("./fontStore");
    useFontStore.getState().setFontSizeMono(18);

    expect(useFontStore.getState().fontSizeMono).toBe(18);
    expect(saveMock).toHaveBeenCalledWith({ fontSizeMono: 18 });
  });

  it("setTerminalLineHeight updates state and calls saveSettings", async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      electronAPI: { saveSettings: saveMock },
    });

    const { useFontStore } = await import("./fontStore");
    useFontStore.getState().setTerminalLineHeight(1.8);

    expect(useFontStore.getState().terminalLineHeight).toBe(1.8);
    expect(saveMock).toHaveBeenCalledWith({ terminalLineHeight: 1.8 });
  });

  it("loadFonts reads font size and line height from settings", async () => {
    const getMock = vi.fn().mockResolvedValue({
      fontSans: "Inter",
      fontMono: "Fira Code",
      fontSizeMono: 14,
      terminalLineHeight: 1.6,
    });
    const element = { style: { setProperty: vi.fn() } };
    vi.stubGlobal("window", {
      electronAPI: { getSettings: getMock },
      document: { documentElement: element },
    });

    const { useFontStore } = await import("./fontStore");
    await useFontStore.getState().loadFonts();

    expect(useFontStore.getState().fontSizeMono).toBe(14);
    expect(useFontStore.getState().terminalLineHeight).toBe(1.6);
  });

  it("loadFonts keeps default sizes when settings has no size values", async () => {
    const getMock = vi.fn().mockResolvedValue({});
    const element = { style: { setProperty: vi.fn() } };
    vi.stubGlobal("window", {
      electronAPI: { getSettings: getMock },
      document: { documentElement: element },
    });

    const { useFontStore } = await import("./fontStore");
    await useFontStore.getState().loadFonts();

    expect(useFontStore.getState().fontSizeMono).toBe(DEFAULT_FONT_SIZE_MONO);
    expect(useFontStore.getState().terminalLineHeight).toBe(DEFAULT_TERMINAL_LINE_HEIGHT);
  });
});
