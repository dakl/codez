# CLAUDE.md — Codez

## Project Overview

Codez is a macOS desktop app that wraps Claude Code's CLI. It manages multiple parallel agent sessions across git worktrees with keyboard-first navigation, a PTY-based terminal, and customizable themes.

## Tech Stack

- **Runtime**: Electron 40 (macOS only)
- **Renderer**: React 19 + TypeScript + Tailwind CSS 4 + Zustand 5
- **Build**: Vite (renderer), tsc (main process)
- **Database**: better-sqlite3 (SQLite with WAL mode)
- **Terminal**: node-pty + xterm.js
- **Auto-updater**: electron-updater (GitHub releases)
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
| Global shortcuts | Unit tests for key binding hooks |
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

### Dev Mode

Always use `make dev` to start the dev app — it uses an isolated database at `~/.codez-dev/` so it's safe to run alongside the production Codez app.

### Releasing

When releasing a new version, ALWAYS trigger the Release workflow after pushing:

```bash
gh workflow run Release --ref main -f version=<version>
```

This builds the DMG on macOS CI and attaches it to the GitHub release. Without this, the release is source-only.

## Architecture

### Directory Structure

```
src/
├── shared/           # Types shared between main and renderer
│   ├── types.ts      # ElectronAPI interface, app types
│   ├── agent-types.ts # AgentEvent, SessionInfo
│   └── constants.ts  # IPC channel names
├── main/             # Electron main process
│   ├── index.ts      # App entry, window creation
│   ├── preload.ts    # contextBridge
│   ├── ipc-handlers.ts
│   ├── paths.ts
│   ├── settings.ts
│   ├── updater.ts    # Auto-updater (electron-updater)
│   ├── dock.ts       # Dock icon customization
│   ├── db/           # SQLite database layer
│   ├── agents/       # Claude adapter + stream parser + agent registry
│   ├── worktree/     # Git worktree management
│   └── services/     # PTY manager, session lifecycle, sideband detector
├── renderer/         # React UI
│   ├── stores/       # Zustand state stores (session, repo, theme)
│   ├── hooks/        # Global shortcuts, chord shortcuts
│   ├── components/   # SessionView, Sidebar, SettingsPanel, Tooltip
│   ├── themes.ts     # Theme definitions (6 themes)
│   └── styles/
└── __fixtures__/     # Test fixture files
```

### Agent Abstraction

Currently only Claude Code is supported. The adapter normalizes CLI interaction:

```
AgentAdapter (abstract class)
└── ClaudeAdapter     # claude -p "msg" --output-format stream-json
```

Key design: Claude Code in `-p` mode exits after each turn. Multi-turn conversation spawns successive `claude -p "msg" --resume <id>` processes. The agent runs inside a PTY (node-pty) rendered via xterm.js in the UI.

### PTY-Based Terminal

Each session runs Claude Code inside a PTY managed by `PtyManager`. The `SidebandDetector` monitors PTY output to detect when the agent is waiting for input (500ms silence heuristic), which updates the session status. The terminal is rendered in the UI via xterm.js (`TerminalView`).

### IPC Convention

Channel names follow `<domain>:<action>`:
- `sessions:create`, `sessions:list`, `sessions:delete`, `sessions:archive`, `sessions:restore`
- `pty:create`, `pty:input`, `pty:resize`, `pty:kill`
- `repos:add`, `repos:remove`, `repos:list`, `repos:selectDialog`, `repos:getBranch`
- `settings:get`, `settings:save`, `settings:getShortcuts`, `settings:saveShortcuts`
- `updater:check`, `updater:download`, `updater:quitAndInstall`
- `app:getInfo`

### Worktree Management

Codez manages worktrees for session isolation:
- Created at `<repo>/.codez/worktrees/<session-id>/` (configurable base dir)
- Symlinks `.claude/` from the main repo into the worktree
- Agent process `cwd` = worktree path
- Cleaned up on session deletion

### Session Status Flow

```
idle → running → waiting_for_input → running → ... → archived (on clean exit)
                → error (on non-zero exit)
```

`waiting_for_input` is detected by the SidebandDetector (500ms PTY silence). Clean process exit (code 0) auto-archives the session.

### Themes and Dock Icons

- 6 built-in themes: midnight, ember, forest, snow, sand, dawn
- 9 dock icon variants (icon-01 through icon-09), selectable in settings

### Database Schema (v4)

3 tables:
- `repos` — tracked repositories (path, name, last_used)
- `sessions` — agent sessions (id, repo_path, worktree_path, agent_type, status, name, branch_name, sort_order, ...)
- `messages` — session messages (role, content, tool_name, tool_id, is_error, thinking, ...)

WAL mode and foreign keys enabled. Migrations are versioned inline.

## Code Conventions

- TypeScript strict mode
- Explicit variable names, no abbreviations
- Comments only where logic is non-obvious
- Simple, readable solutions over clever ones
- Biome for formatting and linting (not Prettier/ESLint)

### Patterns from PaperShelf

These patterns are ported from ~/dev/papershelf and should be maintained:
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
