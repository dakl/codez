import { create } from "zustand";

export const DEFAULT_FONT_SANS = "Geist";
export const DEFAULT_FONT_MONO = "Geist Mono";
export const DEFAULT_FONT_SIZE_MONO = 13;
export const DEFAULT_TERMINAL_LINE_HEIGHT = 1.4;

function buildFontValue(familyName: string, fallback: string): string {
  return `"${familyName}", ${fallback}`;
}

export function applyFontsToElement(fontSans: string, fontMono: string, element: HTMLElement): void {
  element.style.setProperty("--font-sans", buildFontValue(fontSans, "ui-sans-serif, system-ui, sans-serif"));
  element.style.setProperty("--font-mono", buildFontValue(fontMono, "ui-monospace, monospace"));
}

interface FontState {
  fontSans: string;
  fontMono: string;
  fontSizeMono: number;
  terminalLineHeight: number;

  setFontSans: (font: string) => void;
  setFontMono: (font: string) => void;
  setFontSizeMono: (size: number) => void;
  setTerminalLineHeight: (height: number) => void;
  loadFonts: () => Promise<void>;
}

export const useFontStore = create<FontState>((set, get) => ({
  fontSans: DEFAULT_FONT_SANS,
  fontMono: DEFAULT_FONT_MONO,
  fontSizeMono: DEFAULT_FONT_SIZE_MONO,
  terminalLineHeight: DEFAULT_TERMINAL_LINE_HEIGHT,

  setFontSans: (font) => {
    set({ fontSans: font });
    if (typeof window !== "undefined" && window.document) {
      applyFontsToElement(font, get().fontMono, window.document.documentElement);
    }
    if (window.electronAPI) {
      window.electronAPI.saveSettings({ fontSans: font });
    }
  },

  setFontMono: (font) => {
    set({ fontMono: font });
    if (typeof window !== "undefined" && window.document) {
      applyFontsToElement(get().fontSans, font, window.document.documentElement);
    }
    if (window.electronAPI) {
      window.electronAPI.saveSettings({ fontMono: font });
    }
  },

  setFontSizeMono: (size) => {
    set({ fontSizeMono: size });
    if (window.electronAPI) {
      window.electronAPI.saveSettings({ fontSizeMono: size });
    }
  },

  setTerminalLineHeight: (height) => {
    set({ terminalLineHeight: height });
    if (window.electronAPI) {
      window.electronAPI.saveSettings({ terminalLineHeight: height });
    }
  },

  loadFonts: async () => {
    if (!window.electronAPI) return;
    const settings = await window.electronAPI.getSettings();
    const fontSans = settings.fontSans ?? DEFAULT_FONT_SANS;
    const fontMono = settings.fontMono ?? DEFAULT_FONT_MONO;
    const fontSizeMono = settings.fontSizeMono ?? DEFAULT_FONT_SIZE_MONO;
    const terminalLineHeight = settings.terminalLineHeight ?? DEFAULT_TERMINAL_LINE_HEIGHT;
    set({ fontSans, fontMono, fontSizeMono, terminalLineHeight });
    if (typeof window !== "undefined" && window.document) {
      applyFontsToElement(fontSans, fontMono, window.document.documentElement);
    }
  },
}));
