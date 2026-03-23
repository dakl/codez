import type { AgentType } from "@shared/agent-types";
import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { useFontStore } from "../../stores/fontStore";
import { useThemeStore } from "../../stores/themeStore";
import { getThemeById, type ThemeDefinition } from "../../themes";

interface TerminalViewProps {
  sessionId: string;
  agentType: AgentType;
  worktreePath: string;
  isActive: boolean;
}

function buildTerminalTheme(appTheme: ThemeDefinition): ITheme {
  const c = appTheme.colors;
  if (appTheme.mode === "light") {
    return {
      background: c.base,
      foreground: c["text-primary"],
      cursor: c.accent,
      cursorAccent: c.base,
      selectionBackground: `${c.accent}33`,
      black: c["text-primary"],
      red: "#C41A16",
      green: "#007400",
      yellow: "#826B28",
      blue: "#0000D6",
      magenta: "#A90D91",
      cyan: "#3E8D75",
      white: c["text-muted"],
      brightBlack: c["text-secondary"],
      brightRed: "#EB3223",
      brightGreen: "#1AAF1B",
      brightYellow: "#A47E3B",
      brightBlue: "#2644DA",
      brightMagenta: "#C239B3",
      brightCyan: "#44ACA0",
      brightWhite: c.base,
    };
  }
  return {
    background: c.base,
    foreground: c["text-primary"],
    cursor: c.accent,
    cursorAccent: c.base,
    selectionBackground: `${c.accent}33`,
    black: c.surface,
    red: "#FF6B6B",
    green: "#51CF66",
    yellow: "#FFD43B",
    blue: "#6C5CE7",
    magenta: "#CC5DE8",
    cyan: "#22B8CF",
    white: c["text-primary"],
    brightBlack: c["text-muted"],
    brightRed: "#FF8787",
    brightGreen: "#69DB7C",
    brightYellow: "#FFE066",
    brightBlue: "#9775FA",
    brightMagenta: "#E599F7",
    brightCyan: "#66D9E8",
    brightWhite: "#F8F9FA",
  };
}

export function TerminalView({ sessionId, agentType, worktreePath, isActive }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const pendingWritesRef = useRef<string[]>([]);
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const fontMono = useFontStore((state) => state.fontMono);
  const fontSizeMono = useFontStore((state) => state.fontSizeMono);
  const terminalLineHeight = useFontStore((state) => state.terminalLineHeight);

  isActiveRef.current = isActive;

  // Initialize terminal once on mount.
  // Defer terminal.open() to a RAF so React strict mode's first mount/unmount
  // cycle completes before xterm starts its internal animation callbacks.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeThemeId excluded — theme updates handled by separate effect
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    let disposed = false;
    const container = containerRef.current;
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;

    const initRafId = requestAnimationFrame(() => {
      if (disposed) return;

      const appTheme = getThemeById(activeThemeId);
      const currentFontState = useFontStore.getState();
      terminal = new Terminal({
        fontFamily: `"${currentFontState.fontMono}", monospace`,
        fontSize: currentFontState.fontSizeMono,
        lineHeight: currentFontState.terminalLineHeight,
        theme: buildTerminalTheme(appTheme),
        cursorBlink: true,
        allowProposedApi: true,
        scrollback: 10000,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(container);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      try {
        fitAddon.fit();
      } catch {
        // fit() can throw during initial layout
      }

      const cols = terminal.cols;
      const rows = terminal.rows;
      window.electronAPI.ptyCreate(sessionId, agentType, worktreePath, cols, rows);

      // Intercept Shift+Enter to send newline instead of carriage return.
      // Claude Code uses Shift+Enter for multi-line input.
      // Must block both keydown and keypress to prevent xterm sending \r.
      terminal.attachCustomKeyEventHandler((event) => {
        if (event.key === "Enter" && event.shiftKey) {
          if (event.type === "keydown") {
            window.electronAPI.ptyInput(sessionId, "\n");
          }
          return false;
        }
        return true;
      });

      // Forward keystrokes to PTY
      terminal.onData((data) => {
        window.electronAPI.ptyInput(sessionId, data);
      });

      // Subscribe to PTY output — buffer writes when terminal is hidden
      unsubData = window.electronAPI.onPtyData((sid, data) => {
        if (sid !== sessionId || disposed) return;
        if (isActiveRef.current) {
          terminal?.write(data);
        } else {
          pendingWritesRef.current.push(data);
        }
      });

      unsubExit = window.electronAPI.onPtyExit((sid, exitCode) => {
        if (sid === sessionId && !disposed) {
          terminal?.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
        }
      });

      // Resize handling
      resizeObserver = new ResizeObserver(() => {
        if (disposed) return;
        requestAnimationFrame(() => {
          if (disposed || !fitAddonRef.current) return;
          try {
            fitAddonRef.current.fit();
          } catch {
            return;
          }
          if (terminal) {
            window.electronAPI.ptyResize(sessionId, terminal.cols, terminal.rows);
          }
        });
      });
      resizeObserver.observe(container);

      // Focus the terminal if this session is already active (e.g. just created).
      // The isActive effect won't fire because isActive was true from the start.
      if (isActiveRef.current) {
        terminal.focus();
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(initRafId);
      resizeObserver?.disconnect();
      unsubData?.();
      unsubExit?.();
      window.electronAPI.ptyKill(sessionId);
      terminal?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [sessionId, agentType, worktreePath]);

  // Update terminal theme when app theme changes
  useEffect(() => {
    if (!terminalRef.current) return;
    const appTheme = getThemeById(activeThemeId);
    terminalRef.current.options.theme = buildTerminalTheme(appTheme);
  }, [activeThemeId]);

  // Update terminal font when code font changes
  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.options.fontFamily = `"${fontMono}", monospace`;
    try {
      fitAddonRef.current?.fit();
    } catch {
      // fit() can throw during layout
    }
  }, [fontMono]);

  // Update terminal font size when code font size changes
  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.options.fontSize = fontSizeMono;
    try {
      fitAddonRef.current?.fit();
    } catch {
      // fit() can throw during layout
    }
  }, [fontSizeMono]);

  // Update terminal line height when setting changes
  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.options.lineHeight = terminalLineHeight;
    try {
      fitAddonRef.current?.fit();
    } catch {
      // fit() can throw during layout
    }
  }, [terminalLineHeight]);

  // Re-fit, flush pending writes, scroll to bottom, and focus when becoming active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      // Flush any data that arrived while hidden
      if (pendingWritesRef.current.length > 0) {
        const pending = pendingWritesRef.current.join("");
        pendingWritesRef.current = [];
        terminalRef.current.write(pending);
      }
      terminalRef.current.scrollToBottom();
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // fit() can throw during initialization
        }
        terminalRef.current?.scrollToBottom();
        terminalRef.current?.focus();
      });
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        visibility: isActive ? "visible" : "hidden",
        zIndex: isActive ? 1 : 0,
      }}
    />
  );
}
