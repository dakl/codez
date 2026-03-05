# CLAUDE.md — Codez

## Project Overview

Codez is a macOS desktop app that wraps AI coding CLI agents (Claude Code, Mistral Vibe, Gemini CLI). It manages multiple parallel agent sessions across git worktrees with voice input, keyboard-first navigation, and file diff review.

## Tech Stack

- **Runtime**: Electron 40 (macOS only)
- **Renderer**: React 19 + TypeScript + Tailwind CSS 4 + Zustand 5
- **Build**: Vite (renderer), tsc (main process)
- **Database**: better-sqlite3 (SQLite with WAL mode)
- **Voice**: whisper-node (local Whisper STT via whisper.cpp)
- **Diffs**: @git-diff-view/react
- **Linting/Formatting**: Biome
- **Testing**: vitest (unit/integration), Playwright (E2E)
- **Packaging**: electron-builder

## Development Methodology: Red/Green TDD

Every feature is driven by tests. No implementation code without a failing test first.

### The Cycle

1. **RED**: Write a failing test that describes the desired behavior
2. **GREEN**: Write the minimum code to make it pass
3. **REFACTOR**: Clean up while keeping tests green

### Rules

- Write the test FIRST. Run it. Confirm it fails (red).
- Write only enough code to make the failing test pass (green).
- Do not write implementation code without a corresponding test.
- Do not skip straight to implementation — the test drives the design.
- Refactor only when tests are green.
- Each test should test one behavior. Name tests descriptively: `test("buffers incomplete lines across chunks")`.
- Use fixture files for complex input data (place in `src/__fixtures__/`).

### What Gets Tested

| Layer | Approach |
|-------|----------|
| Stream parsers | Unit tests with fixture JSON lines |
| Agent adapters | Unit tests with snapshot fixtures of real CLI output |
| DB operations | Integration tests against in-memory SQLite |
| Worktree manager | Integration tests against a temp git repo |
| Settings persistence | Unit tests for read/write round-trips |
| Session lifecycle | Integration tests with mocked adapter |
| Zustand stores | Unit tests for state transitions |
| Shortcut system | Unit tests for conflict detection, key building |
| Diff tracker | Unit tests with fixture git diff output |
| React components | Component tests with React Testing Library |
| Full app flows | E2E with Playwright |

### Test File Location

Tests live next to the code they test:
```
src/main/agents/stream-parser.ts
src/main/agents/stream-parser.test.ts
```

### Running Tests

```bash
npm test              # vitest run (all unit/integration tests)
npm run test:watch    # vitest in watch mode
npm run test:e2e      # playwright E2E tests
```

## Commands

```bash
npm run dev           # Start dev mode (main + renderer + electron)
npm run build         # Production build
npm run lint          # Biome check
npm run format        # Biome format
npm test              # Run tests
```

## Architecture

### Directory Structure

```
src/
├── shared/           # Types shared between main and renderer
│   ├── types.ts      # ElectronAPI interface, app types
│   ├── agent-types.ts # AgentEvent, SessionInfo, ChangedFile
│   └── constants.ts  # IPC channel names
├── main/             # Electron main process
│   ├── index.ts      # App entry, window creation
│   ├── preload.ts    # contextBridge
│   ├── ipc-handlers.ts
│   ├── paths.ts
│   ├── settings.ts
│   ├── db/           # SQLite database layer
│   ├── agents/       # Agent abstraction + adapters
│   ├── worktree/     # Git worktree management
│   ├── voice/        # Whisper STT
│   ├── file-watcher/ # Diff tracking
│   └── services/     # Session lifecycle, notifications
├── renderer/         # React UI
│   ├── stores/       # Zustand state stores
│   ├── hooks/        # Custom React hooks
│   ├── components/   # UI components
│   └── styles/
└── __fixtures__/     # Test fixture files
```

### Agent Abstraction

Each CLI agent has an adapter that normalizes the interface:

```
AgentAdapter (abstract class)
├── ClaudeAdapter     # claude -p "msg" --output-format stream-json
├── MistralAdapter    # stub
└── GeminiAdapter     # stub
```

Key design: Claude Code in `-p` mode exits after each turn. Multi-turn conversation spawns successive `claude -p "msg" --resume <id>` processes. No stdin management — just spawn, stream JSON, wait for exit.

### IPC Convention

Channel names follow `<domain>:<action>`:
- `sessions:create`, `sessions:list`, `sessions:delete`
- `voice:startRecording`, `voice:stopAndTranscribe`
- `settings:getShortcuts`, `settings:saveShortcuts`

### Worktree Management

Codex manages worktrees (not individual agents' worktree flags) for cross-agent pluggability:
- Created at `<repo>/.codez/worktrees/<session-id>/`
- Agent process `cwd` = worktree path
- Cleaned up on session deletion

### Session Status Flow

```
idle → running → waiting_for_input → running → ... → completed
                → error
```

`waiting_for_input` triggers: macOS notification + visual banner + sidebar badge.

## Code Conventions

- TypeScript strict mode
- Explicit variable names, no abbreviations
- Comments only where logic is non-obvious
- Simple, readable solutions over clever ones
- Biome for formatting and linting (not Prettier/ESLint)

### Patterns from PaperShelf

These patterns are ported from ~/dev/papershelf and should be maintained:
- **Shortcut store**: Zustand store with defaults, user overrides, conflict detection, Cmd-hold hint visibility
- **Preload bridge**: Typed `ElectronAPI` interface exposed via `contextBridge`
- **IPC handlers**: Registered in a single `ipc-handlers.ts` file
- **Settings**: JSON file persistence with merge semantics
- **DB**: better-sqlite3 with WAL mode, typed row-to-model converters

## Agent CLI Reference

### Claude Code
```bash
# New session
claude -p "prompt" --output-format stream-json --verbose --session-id <id>

# Resume session
claude -p "prompt" --resume <session-id> --output-format stream-json

# Continue most recent
claude -p "prompt" --continue --output-format stream-json
```

#### Stream-JSON Output Format

NDJSON (one JSON object per line). Key message types:

```
{ type: "system", subtype: "init", session_id: "uuid", ... }          // First message
{ type: "stream_event", event: { type: "content_block_delta", ... } }  // Partial streaming
{ type: "assistant", message: { content: [...] }, ... }                // Complete turn
{ type: "result", result: "text", session_id: "uuid", ... }           // Final message
```

Stream event types (inside `event` field, raw Claude API events):
- `message_start` — new message begins
- `content_block_start` — text or tool_use block begins (has `content_block.type`)
- `content_block_delta` — incremental update (`delta.type`: `text_delta` or `input_json_delta`)
- `content_block_stop` — block ends
- `message_delta` — message-level update (stop_reason, usage)
- `message_stop` — message ends

Process exits with code 0 on completion. Multi-turn requires new process with `--continue` or `--resume`.

### Mistral Vibe (future)
```bash
vibe --prompt "text" --output streaming
```

### Gemini CLI (future)
```bash
gemini -p "text" --output-format streaming-json
```
