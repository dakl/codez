# Embedded Terminal Emulator vs. Process Spawning

Should Codez embed a terminal emulator (e.g. xterm.js) and run `claude`/`vibe` inside it, instead of spawning child processes and parsing their stdout?

## Current Architecture (Process Spawn + Stream Parsing)

Today, Codez spawns each agent as a child process with `child_process.spawn()`, captures stdout as NDJSON, and parses it through adapter-specific logic into normalized `AgentEvent`s. There is no terminal — the CLI tools never see a TTY.

## How the Terminal Approach Would Work

Embed [xterm.js](https://xtermjs.org/) (or similar) backed by `node-pty`, giving each session a real pseudo-terminal. The agent CLI runs inside it as if launched from a user's terminal. The UI shows the terminal output directly (or in a hidden buffer), and optionally overlays a custom UI on top.

---

## Pros of Embedding a Terminal

### 1. Full CLI Fidelity
The agent runs in a real PTY — spinners, progress bars, color output, interactive prompts, and TUI elements all Just Work. No need to reimplement or approximate the CLI's native UX.

### 2. Eliminates Stream Parsing Complexity
Today we maintain:
- `StreamParser` (NDJSON buffering, handling partial lines, malformed JSON)
- `ClaudeAdapter` (291 lines parsing Claude's stream-json protocol)
- `MistralAdapter` (362 lines with dual-format support, message deduplication, filesystem scan for session IDs)
- Silent JSON parse failures that are hard to debug

A terminal approach renders the output directly. No parsing layer to maintain or break when CLI output formats change.

### 3. Automatic Support for New CLI Features
When Claude Code adds a new interactive feature (permission prompts, MCP server selection, `/` commands), it works immediately in an embedded terminal. Today, every new feature requires adapter updates.

### 4. Simpler Multi-Turn / Session Resume
Claude and Vibe both have interactive modes (not just `-p`). An embedded terminal could run `claude` in its normal interactive mode, sending user messages as terminal input. No need for the spawn-per-turn pattern or `--resume` flag management. The Vibe session ID filesystem scan hack goes away entirely.

### 5. Reduces Agent-Specific Code
Each new agent (Gemini, Cursor, Aider, etc.) needs only a launch command — no custom adapter, no output format reverse-engineering, no workarounds for missing features in programmatic mode.

### 6. Permission Prompts Work Natively
Today, Claude's permission requests require custom detection (regex matching on tool_result content for directory denials, parsing `control_request` events). In a terminal, the user sees the native prompt and can respond directly.

---

## Cons of Embedding a Terminal

### 1. Loss of Structured Data
This is the biggest trade-off. Today's parsed `AgentEvent`s give us:
- **Structured tool use tracking** — which tools were called, with what inputs, what results
- **Token/cost accounting** — usage stats from `session_end` events
- **Diff detection** — knowing which files changed via tool_result content
- **Message history** — clean assistant/user/tool_use message records in SQLite
- **Thinking blocks** — Claude's extended thinking content

A raw terminal gives us a stream of characters with ANSI escape codes. Extracting structured data from rendered terminal output is *harder* than parsing NDJSON — you'd be screen-scraping your own app.

### 2. Custom UI Becomes Much Harder
Codez's value proposition includes:
- Sidebar with session status badges
- File diff review panel
- Voice input integration
- Keyboard-first navigation across sessions

All of these depend on knowing what the agent is doing (structured events). With a terminal, you'd either lose these features or need a hybrid approach (terminal + parallel parsing), which is worse than either approach alone.

### 3. Multi-Session Management Gets Awkward
Running 5 parallel agent sessions means 5 hidden terminal instances. Each consumes a PTY, a shell process, and memory for the terminal buffer. The current approach is lighter — just a Node child process per session with minimal buffering.

### 4. xterm.js + node-pty Complexity
- `node-pty` is a native module — needs compilation for each Electron/Node version, causes packaging headaches
- xterm.js adds ~200KB+ to the renderer bundle
- Terminal resize handling, scrollback management, and theme synchronization add UI complexity
- Accessibility (screen readers) is worse with terminal output than with structured React components

### 5. Cross-Agent Normalization Disappears
Today, `ClaudeAdapter` and `MistralAdapter` both emit the same `AgentEvent` types. The renderer doesn't care which agent is running. With terminals, each agent's output looks completely different — Claude shows `[tool_use]` blocks, Vibe shows its own format. The UI can't treat them uniformly.

### 6. Testing Becomes Harder
Current approach: feed fixture JSON lines into parsers, assert on emitted events. Clean, fast, deterministic.

Terminal approach: need to simulate PTY output, deal with timing, ANSI codes, terminal state. Snapshot testing against rendered terminal buffers is fragile.

### 7. Stdin Management for Voice Input
Voice transcription currently feeds into `runPrompt()` which spawns a process with the text as an argument. With a terminal, you'd need to write text into the PTY stdin, handle line editing, deal with the agent's input prompt state. What if the agent is mid-output when voice input arrives?

---

## Hybrid Approaches

### Option A: Terminal + Sideband Parsing
Run the agent in a PTY for display, but *also* tap the raw byte stream for structured signals. Crucially, this is **not** a second process or API call — it's a second listener on the same PTY output:

```
agent CLI → node-pty → byte stream
                          ├→ xterm.js (renders terminal for the user)
                          └→ sideband listener (strip ANSI, regex match → state changes)
```

One process, one stream, read twice. The sideband doesn't need full structured parsing — if the goal is just attention state (waiting for input, permission prompt, process exited), it's a few regexes, not a reimplementation of the NDJSON adapter layer.

The original concern was that this "doubles the complexity". That's true if the sideband tries to extract *everything* (tool calls, token counts, message history). But if scoped to just attention signals, the sideband is trivially simple compared to the current adapter code.

### Option B: Terminal for Display, `-p` Mode for Data
Run two processes: one in interactive terminal mode (what the user sees) and one in `-p` mode (for structured data). Absurdly wasteful — double API calls, double token costs.

### Option C: Terminal as Fallback
Use the current structured approach as primary, but offer a "raw terminal" mode for debugging or for agents that don't have a programmatic output format. This is additive complexity but keeps the structured path as default.

### Option D: Terminal-First with Screen Scraping
Embed the terminal, then use ANSI-aware parsing to extract structure from the rendered output. Fragile, agent-specific, and strictly harder than parsing a documented JSON protocol.

---

## Decision Matrix

| Concern | Process Spawn (Current) | Embedded Terminal |
|---------|------------------------|-------------------|
| Structured data access | Native (NDJSON) | Lost or requires hybrid |
| New agent onboarding | Adapter per agent | Just a launch command |
| CLI feature support | Manual adapter updates | Automatic |
| Custom UI (diffs, sidebar) | Easy (structured events) | Hard (no structured data) |
| Multi-turn sessions | Spawn-per-turn + resume | Native interactive mode |
| Testing | Unit tests on fixtures | PTY simulation, fragile |
| Bundle/packaging | Simple (no native deps) | node-pty native module |
| Voice input integration | Clean (prompt argument) | PTY stdin management |
| Session management overhead | Lightweight | PTY + shell per session |
| Maintenance burden | Parser updates per agent | Terminal lib maintenance |

---

## Recommendation

The current pain points (stream parsing, Vibe session ID hacks, adapter maintenance) are real but manageable. The structured data from NDJSON parsing is what enables Codez's core features — session tracking, diff review, cost accounting, and a unified cross-agent UI.

**Embedding a terminal solves the wrong problem.** The hard part isn't displaying agent output — it's *understanding* it. A terminal gives you pixels; the app needs semantics.

The most pragmatic path forward:
1. **Keep the structured approach** as the primary path
2. **Invest in adapter resilience** — better error logging in `StreamParser`, typed output schemas per agent
3. **Consider Option C** (terminal as debug/fallback mode) if users want to see raw CLI output for troubleshooting
4. **Push CLI vendors** for better programmatic output modes rather than working around their limitations

The Vibe session ID hack and dual-format parsing are annoying, but they're local problems with local fixes. Switching to a terminal emulator trades those local problems for a global loss of structured data that would require rewriting the entire UI layer.

---

## Revisiting Against Core Feature Requirements

The above analysis was tested against Codez's actual desired feature set:

1. **Push-to-talk STT** + keyboard input
2. **Keyboard navigation** between sessions
3. **Attention indicators** — sessions needing input or in error state
4. **Paste images & text** as agent context
5. **Polished, non-janky UX** — must feel native, not hacked together

### How Each Approach Serves These Features

| Feature | Structured | Terminal |
|---------|-----------|----------|
| PTT/STT input | Clean — pass transcribed text as CLI arg | Harder — write into PTY stdin, manage prompt state |
| Keyboard nav | Clean — lightweight session switching | OK — switch between PTY instances |
| Attention indicators | Clean — `waiting_for_input` from parsed events | Feasible — lightweight pattern matching on PTY byte stream (see below) |
| Paste images & text | Must build — capture image, save to disk, pass via `--image` flags | Free — CLIs already handle image paste natively in TTY mode |
| Polished UX | Full React control over rendering | Constrained by xterm.js look/feel |

### Attention Detection from a Terminal is Not Hard

The original analysis framed attention detection as "screen scraping" — but that overstates the difficulty. You're not reading pixels off a rendered screen. You're watching the raw byte stream flowing through the PTY, which is much simpler:

1. **Strip ANSI escape codes** — solved problem, many libraries handle this
2. **Match a few prompt patterns per agent** — Claude shows a `>` prompt, Vibe shows its own
3. **Prompt visible + output idle = waiting for input**

The only signals needed for attention indicators:

| State | Detection |
|-------|-----------|
| Waiting for input | Prompt pattern + idle output |
| Completed / Error | Process exited (exit code distinguishes) |
| Permission prompt | Agent-specific pattern match (e.g., "Allow?" / "[y/n]") |

This is a few regexes per agent — not a full structured parser. You don't need to understand tool calls, token counts, or message structure. Just: "is this session waiting for me?"

This significantly improves the viability of the hybrid approach.

### Key Insight: Slash Commands

A significant cost of the structured approach that wasn't fully appreciated in the original analysis: **CLI slash commands** (`/compact`, `/review`, `/mcp`, etc.) must each be explicitly supported. Every slash command requires:

- Detecting the command in the Codez input box
- Translating it to the right CLI mechanism (some are stdin commands, some are flags)
- Handling the response format, which may differ from normal output

Each CLI tool has its own set of slash commands, and they change over time. With a terminal, the user just types the command and it works. With the structured approach, Codez is always playing catch-up with upstream CLI features.

### The Spectrum

This isn't a binary choice. There's a spectrum:

- **Pure terminal**: Slash commands, image paste, interactive prompts, permission dialogs — all free. But lose structured data, attention indicators, and custom UI control.
- **Pure structured**: Full control over UX, attention indicators, polished rendering. But re-implement every CLI feature to expose it.
- **Hybrid (terminal-primary + sideband extraction)**: Terminal for display and interaction, with targeted parsing of the byte stream to extract just the structured signals needed (session state, attention indicators). More complex, but potentially the best of both worlds.

### Revised Thinking

The original recommendation assumed attention indicators require full structured parsing. They don't — lightweight pattern matching on the PTY byte stream is sufficient for session state detection.

With that corrected, the balance shifts further toward a terminal-primary hybrid:

- **Attention indicators**: achievable with simple regex on the byte stream
- **Slash commands**: free in a terminal, ongoing maintenance burden in structured
- **Image paste**: free in a terminal, must build in structured
- **Polished UX**: the main remaining argument for structured — full React control over rendering

The open question is whether the UX can feel polished enough with an embedded terminal (xterm.js theming, font matching, seamless integration with the surrounding React chrome), or whether the terminal will always feel like a foreign element.

**Option A (terminal + sideband extraction)** is the most promising path. The sideband only needs to extract attention state (a few regexes), not full structured events. This is dramatically simpler than maintaining complete per-agent NDJSON parsers.
