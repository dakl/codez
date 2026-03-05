# Codez

A macOS desktop app for managing AI coding agent sessions. Wraps CLI agents (Claude Code, Mistral Vibe, Gemini CLI) in a native Electron shell with multiple parallel sessions, git worktree isolation, voice input, and file diff review.

## Features

- **Multi-agent support** — Claude Code today, Mistral Vibe and Gemini CLI planned
- **Parallel sessions** — run multiple agent conversations side by side
- **Git worktree isolation** — each session gets its own worktree so agents don't collide
- **Voice input** — local speech-to-text via whisper.cpp
- **File diff review** — inspect agent changes before committing
- **Keyboard-first** — customizable shortcuts with conflict detection

## Requirements

- macOS
- Node.js 20+
- npm

## Getting Started

```bash
npm install
npm run dev
```

This starts the main process, Vite dev server, and Electron concurrently with hot reload.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev mode (main + renderer + Electron) |
| `npm run build` | Production build |
| `npm test` | Run unit/integration tests (vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run lint` | Biome lint check |
| `npm run format` | Biome format |
| `npm run dist` | Package with electron-builder |

## Tech Stack

- **Runtime**: Electron 40
- **Renderer**: React 19, TypeScript, Tailwind CSS 4, Zustand 5
- **Build**: Vite (renderer), tsc (main process)
- **Database**: better-sqlite3 (SQLite, WAL mode)
- **Voice**: whisper-node
- **Linting/Formatting**: Biome
- **Testing**: Vitest + Playwright
- **Packaging**: electron-builder

## Architecture

```
src/
├── shared/           # Types shared between main and renderer
├── main/             # Electron main process
│   ├── db/           # SQLite database layer
│   ├── agents/       # Agent abstraction + adapters
│   ├── worktree/     # Git worktree management
│   ├── voice/        # Whisper STT
│   ├── file-watcher/ # Diff tracking
│   └── services/     # Session lifecycle, notifications
├── renderer/         # React UI
│   ├── stores/       # Zustand state stores
│   ├── hooks/        # Custom React hooks
│   └── components/   # UI components
└── __fixtures__/     # Test fixture files
```

Each CLI agent has an adapter that normalizes its interface. Claude Code in `-p` mode exits after each turn — multi-turn conversation spawns successive processes with `--resume`. No stdin management, just spawn, stream NDJSON, wait for exit.

## License

MIT
