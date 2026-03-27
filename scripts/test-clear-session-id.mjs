#!/usr/bin/env node
/**
 * Test suite: What changes Claude Code's session ID?
 *
 * Test 1: Does /clear change the session ID?
 * Test 2: Does --resume with a non-existent UUID error or silently create?
 * Test 3: Do two sessions in the SAME directory (no worktrees) stay isolated?
 * Test 4: Does a session in a worktree sub-directory stay isolated?
 *
 * All steps use node-pty so Claude gets a real TTY for trust prompts.
 *
 * Usage:
 *   node scripts/test-clear-session-id.mjs           # run all tests
 *   node scripts/test-clear-session-id.mjs 1          # run test 1 only
 *   node scripts/test-clear-session-id.mjs 3 4        # run tests 3 and 4
 */

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as pty from "node-pty";

const TIMEOUT_MS = 120_000;

function makeEnv() {
  const env = { ...process.env, TERM: "xterm-256color" };
  delete env.CLAUDECODE;
  return env;
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
}

/**
 * Run `claude -p` in a PTY and extract session_id from the stream-json init message.
 */
function runClaudePrompt(sessionArgs, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      'respond with just the word "pong"',
      ...sessionArgs,
      "--output-format",
      "stream-json",
      "--verbose",
    ];
    console.log(`  $ claude ${args.join(" ")}`);
    if (cwd !== process.cwd()) console.log(`    cwd: ${cwd}`);

    const proc = pty.spawn("claude", args, {
      cols: 200,
      rows: 24,
      cwd,
      env: makeEnv(),
    });

    let output = "";
    proc.onData((data) => { output += data; });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    proc.onExit(({ exitCode }) => {
      clearTimeout(timer);
      const clean = stripAnsi(output);
      for (const line of clean.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === "system" && parsed.subtype === "init") {
            resolve({ sessionId: parsed.session_id, exitCode, output: clean });
            return;
          }
        } catch { /* not JSON */ }
      }
      reject(
        new Error(`No init message found. exit=${exitCode}\nOutput (first 2000):\n${clean.slice(0, 2000)}`)
      );
    });
  });
}

/** Spawn interactive Claude, send a command, wait, then kill. */
function runInteractiveCommand(sessionId, command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const args = ["--resume", sessionId];
    console.log(`  $ claude ${args.join(" ")}  (interactive PTY)`);

    const proc = pty.spawn("claude", args, {
      cols: 120,
      rows: 24,
      cwd,
      env: makeEnv(),
    });

    let output = "";
    proc.onData((data) => { output += data; });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Interactive session timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    proc.onExit(() => {
      clearTimeout(timer);
      resolve(output);
    });

    setTimeout(() => {
      console.log(`  Sending ${command}...`);
      proc.write(command + "\r");
      setTimeout(() => {
        proc.kill();
      }, 5_000);
    }, 8_000);
  });
}

/** Create a temp directory with a git repo initialized. */
function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "codez-session-test-"));
  execSync("git init", { cwd: dir, stdio: "ignore" });
  writeFileSync(join(dir, "README.md"), "# test repo\n");
  execSync("git add . && git commit -m 'init'", { cwd: dir, stdio: "ignore" });
  return dir;
}

// ── Test 1: /clear ──────────────────────────────────────────────────

async function test1_clear() {
  const sessionId = randomUUID();
  console.log("=== Test 1: Does /clear change the session ID? ===\n");
  console.log(`Session ID: ${sessionId}\n`);

  console.log("Step 1: Creating session...");
  const initial = await runClaudePrompt(["--session-id", sessionId]);
  console.log(`  -> Initial session_id: ${initial.sessionId}\n`);

  console.log("Step 2: Running /clear...");
  await runInteractiveCommand(initial.sessionId, "/clear");
  console.log(`  -> Done\n`);

  console.log("Step 3: Resuming...");
  const resumed = await runClaudePrompt(["--resume", initial.sessionId]);
  console.log(`  -> Resumed session_id: ${resumed.sessionId}\n`);

  const pass = initial.sessionId === resumed.sessionId;
  console.log(pass
    ? "PASS: Session ID unchanged after /clear\n"
    : `FAIL: Session ID changed! ${initial.sessionId} -> ${resumed.sessionId}\n`);
  return pass;
}

// ── Test 2: --resume non-existent UUID ──────────────────────────────

async function test2_resumeNonExistent() {
  const fakeId = randomUUID();
  console.log("=== Test 2: --resume with non-existent UUID ===\n");
  console.log(`Fake session ID: ${fakeId}\n`);

  try {
    const result = await runClaudePrompt(["--resume", fakeId]);
    console.log(`  -> Got session_id: ${result.sessionId}`);
    const same = result.sessionId === fakeId;
    console.log(same
      ? "FAIL: --resume silently created a new session with requested UUID\n"
      : `INFO: --resume returned different ID: ${result.sessionId}\n`);
    return false;
  } catch (err) {
    const hasError = err.message.includes("No conversation found") || err.message.includes("exit=1");
    console.log(hasError
      ? "PASS: --resume with unknown UUID errors (does not silently create)\n"
      : `UNEXPECTED: ${err.message.slice(0, 300)}\n`);
    return hasError;
  }
}

// ── Test 3: Two sessions, same directory (no worktrees) ─────────────

async function test3_sameDirIsolation() {
  console.log("=== Test 3: Two sessions in same directory (no worktrees) ===\n");

  const repoDir = makeTempRepo();
  console.log(`Temp repo: ${repoDir}\n`);

  const idA = randomUUID();
  const idB = randomUUID();

  // Create session A
  console.log("Creating session A...");
  const a1 = await runClaudePrompt(["--session-id", idA], repoDir);
  console.log(`  -> A session_id: ${a1.sessionId}\n`);

  // Create session B in the SAME directory
  console.log("Creating session B (same dir)...");
  const b1 = await runClaudePrompt(["--session-id", idB], repoDir);
  console.log(`  -> B session_id: ${b1.sessionId}\n`);

  // Resume A — does it still return A's session ID?
  console.log("Resuming session A...");
  const a2 = await runClaudePrompt(["--resume", idA], repoDir);
  console.log(`  -> A resumed session_id: ${a2.sessionId}\n`);

  // Resume B — does it still return B's session ID?
  console.log("Resuming session B...");
  const b2 = await runClaudePrompt(["--resume", idB], repoDir);
  console.log(`  -> B resumed session_id: ${b2.sessionId}\n`);

  const aOk = a1.sessionId === a2.sessionId;
  const bOk = b1.sessionId === b2.sessionId;
  const isolated = a1.sessionId !== b1.sessionId;

  console.log(`Session A consistent: ${aOk ? "YES" : "NO"}`);
  console.log(`Session B consistent: ${bOk ? "YES" : "NO"}`);
  console.log(`Sessions isolated:    ${isolated ? "YES" : "NO"}`);

  const pass = aOk && bOk && isolated;
  console.log(pass
    ? "\nPASS: Two sessions in same directory stay isolated\n"
    : "\nFAIL: Sessions interfered with each other\n");
  return pass;
}

// ── Test 4: Worktree sub-directory session isolation ─────────────────

async function test4_worktreeIsolation() {
  console.log("=== Test 4: Session in worktree sub-directory ===\n");

  const repoDir = makeTempRepo();
  const worktreeDir = join(repoDir, ".codez", "worktrees", "test-session");
  mkdirSync(worktreeDir, { recursive: true });

  // Create a worktree (simulated — just a git init in the subdir)
  execSync("git init", { cwd: worktreeDir, stdio: "ignore" });
  writeFileSync(join(worktreeDir, "README.md"), "# worktree\n");
  execSync("git add . && git commit -m 'init'", { cwd: worktreeDir, stdio: "ignore" });

  console.log(`Repo dir:     ${repoDir}`);
  console.log(`Worktree dir: ${worktreeDir}\n`);

  const sessionId = randomUUID();

  // Create session in worktree
  console.log("Creating session in worktree dir...");
  const initial = await runClaudePrompt(["--session-id", sessionId], worktreeDir);
  console.log(`  -> session_id: ${initial.sessionId}\n`);

  // Resume from worktree dir
  console.log("Resuming from worktree dir...");
  const resumed = await runClaudePrompt(["--resume", sessionId], worktreeDir);
  console.log(`  -> session_id: ${resumed.sessionId}\n`);

  // Try to resume from PARENT repo dir — should this work?
  console.log("Attempting resume from PARENT repo dir (different cwd)...");
  try {
    const fromParent = await runClaudePrompt(["--resume", sessionId], repoDir);
    console.log(`  -> session_id: ${fromParent.sessionId}`);
    console.log(`  INFO: Resume from different cwd succeeded (session_id: ${fromParent.sessionId})\n`);
  } catch (err) {
    const isNotFound = err.message.includes("No conversation found");
    console.log(isNotFound
      ? "  INFO: Resume from different cwd failed (session not found) — sessions ARE directory-scoped\n"
      : `  INFO: Resume from different cwd failed: ${err.message.slice(0, 200)}\n`);
  }

  const pass = initial.sessionId === resumed.sessionId;
  console.log(pass
    ? "PASS: Worktree session resumes correctly from same dir\n"
    : `FAIL: Session ID changed: ${initial.sessionId} -> ${resumed.sessionId}\n`);
  return pass;
}

// ── Test 5: --resume non-existent UUID in INTERACTIVE mode ──────────
// This is the key test: does interactive Claude fall back to the most
// recent session in the directory instead of erroring?

async function test5_resumeNonExistentInteractive() {
  console.log("=== Test 5: --resume non-existent UUID in INTERACTIVE PTY mode ===\n");

  const repoDir = makeTempRepo();
  console.log(`Temp repo: ${repoDir}\n`);

  // Step 1: Create a real session so there IS a "most recent" session to fall back to
  const realSessionId = randomUUID();
  console.log("Step 1: Creating a real session (so fallback target exists)...");
  const real = await runClaudePrompt(["--session-id", realSessionId], repoDir);
  console.log(`  -> Real session_id: ${real.sessionId}\n`);

  // Step 2: Try --resume with a fake UUID in INTERACTIVE mode (no -p flag)
  const fakeId = randomUUID();
  console.log(`Step 2: Spawning interactive claude --resume ${fakeId}...`);
  console.log("  (This is the key test — does it error or fall back?)\n");

  const interactiveResult = await new Promise((resolve, reject) => {
    const args = ["--resume", fakeId];
    console.log(`  $ claude ${args.join(" ")}  (interactive PTY, cwd: ${repoDir})`);

    const proc = pty.spawn("claude", args, {
      cols: 200,
      rows: 24,
      cwd: repoDir,
      env: makeEnv(),
    });

    let output = "";
    proc.onData((data) => { output += data; });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ output: stripAnsi(output), timedOut: true, exitCode: null });
    }, 30_000);

    proc.onExit(({ exitCode }) => {
      clearTimeout(timer);
      resolve({ output: stripAnsi(output), timedOut: false, exitCode });
    });
  });

  const { output, timedOut, exitCode } = interactiveResult;
  console.log(`  Timed out: ${timedOut}`);
  console.log(`  Exit code: ${exitCode}`);
  console.log(`  Output (first 1500 chars):\n${output.slice(0, 1500)}\n`);

  // Check what happened:
  // - If it errored with "No conversation found" → good, it doesn't fall back
  // - If it started a session (shows prompt, init message) → BAD, it fell back
  const hasError = output.includes("No conversation found") ||
                   output.includes("not found") ||
                   output.includes("does not exist");
  const hasPrompt = output.includes(">") || output.includes("Claude");
  const fellBack = !hasError && (timedOut || hasPrompt);

  if (hasError) {
    console.log("PASS: Interactive --resume with unknown UUID errors (does not fall back)\n");
    return true;
  } else if (fellBack) {
    // Try to detect if it resumed the REAL session
    const resumedReal = output.includes(real.sessionId);
    console.log(`FAIL: Interactive --resume fell back to ${resumedReal ? "the existing" : "some"} session instead of erroring`);
    console.log("  This explains the Codez session-switching bug!\n");
    return false;
  } else {
    console.log(`INCONCLUSIVE: Unexpected behavior. Exit code: ${exitCode}\n`);
    return false;
  }
}

// ── Test 6: --session-id with an EXISTING session ───────────────────
// Can we use --session-id instead of --resume to avoid the fallback bug?

async function test6_sessionIdWithExisting() {
  console.log("=== Test 6: --session-id with an EXISTING session (reuse instead of --resume) ===\n");

  const repoDir = makeTempRepo();
  const sessionId = randomUUID();

  // Step 1: Create a session
  console.log("Step 1: Creating session with --session-id...");
  const initial = await runClaudePrompt(["--session-id", sessionId], repoDir);
  console.log(`  -> session_id: ${initial.sessionId}\n`);

  // Step 2: Use --session-id AGAIN with the same UUID (not --resume)
  console.log("Step 2: Using --session-id again with the SAME UUID...");
  const reused = await runClaudePrompt(["--session-id", sessionId], repoDir);
  console.log(`  -> session_id: ${reused.sessionId}\n`);

  const same = initial.sessionId === reused.sessionId;
  console.log(same
    ? "PASS: --session-id with existing UUID resumes the same session\n"
    : `FAIL: --session-id returned different ID: ${initial.sessionId} vs ${reused.sessionId}\n`);
  return same;
}

// ── Test 7: --session-id with non-existent UUID (interactive mode) ──
// Does --session-id correctly create a NEW session with our UUID in interactive mode?

async function test7_sessionIdInteractive() {
  console.log("=== Test 7: --session-id in INTERACTIVE PTY mode ===\n");

  const repoDir = makeTempRepo();

  // Create another session first (so there's a "most recent" to potentially fall back to)
  const decoyId = randomUUID();
  console.log("Step 1: Creating decoy session...");
  await runClaudePrompt(["--session-id", decoyId], repoDir);
  console.log("  -> Done\n");

  // Now use --session-id with a NEW UUID in interactive mode
  const targetId = randomUUID();
  console.log(`Step 2: Spawning interactive claude --session-id ${targetId}...`);

  const interactiveResult = await new Promise((resolve, reject) => {
    const args = ["--session-id", targetId];
    console.log(`  $ claude ${args.join(" ")}  (interactive PTY, cwd: ${repoDir})`);

    const proc = pty.spawn("claude", args, {
      cols: 200,
      rows: 24,
      cwd: repoDir,
      env: makeEnv(),
    });

    let output = "";
    proc.onData((data) => { output += data; });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ output: stripAnsi(output), timedOut: true });
    }, 30_000);

    proc.onExit(({ exitCode }) => {
      clearTimeout(timer);
      resolve({ output: stripAnsi(output), timedOut: false, exitCode });
    });
  });

  const { output, timedOut } = interactiveResult;
  console.log(`  Output (first 500 chars): ${output.slice(0, 500)}\n`);

  // Now verify: resume this session with -p mode to check its session_id
  console.log("Step 3: Verifying session was created with our UUID via -p --resume...");
  try {
    const verified = await runClaudePrompt(["--resume", targetId], repoDir);
    console.log(`  -> session_id: ${verified.sessionId}`);
    const pass = verified.sessionId === targetId;
    console.log(pass
      ? "\nPASS: --session-id in interactive mode correctly uses our UUID\n"
      : `\nFAIL: Got different session ID: ${verified.sessionId}\n`);
    return pass;
  } catch (err) {
    console.log(`  -> Error: ${err.message.slice(0, 300)}`);
    console.log("\nFAIL: Could not resume the session (was it created with our UUID?)\n");
    return false;
  }
}

// ── Runner ──────────────────────────────────────────────────────────

const tests = {
  1: { name: "/clear", fn: test1_clear },
  2: { name: "--resume non-existent (-p mode)", fn: test2_resumeNonExistent },
  3: { name: "same-dir isolation", fn: test3_sameDirIsolation },
  4: { name: "worktree isolation", fn: test4_worktreeIsolation },
  5: { name: "--resume non-existent (interactive)", fn: test5_resumeNonExistentInteractive },
  6: { name: "--session-id with existing", fn: test6_sessionIdWithExisting },
  7: { name: "--session-id interactive", fn: test7_sessionIdInteractive },
};

async function main() {
  const requested = process.argv.slice(2).map(Number).filter(Boolean);
  const toRun = requested.length > 0 ? requested : Object.keys(tests).map(Number);

  console.log(`Running tests: ${toRun.join(", ")}\n`);
  console.log("=".repeat(60) + "\n");

  const results = {};
  for (const num of toRun) {
    const test = tests[num];
    if (!test) {
      console.log(`Unknown test: ${num}\n`);
      continue;
    }
    try {
      results[num] = await test.fn();
    } catch (err) {
      console.log(`ERROR in test ${num}: ${err.message}\n`);
      results[num] = false;
    }
    console.log("=".repeat(60) + "\n");
  }

  // Summary
  console.log("=== SUMMARY ===\n");
  for (const [num, pass] of Object.entries(results)) {
    console.log(`  Test ${num} (${tests[num].name}): ${pass ? "PASS" : "FAIL"}`);
  }

  const allPass = Object.values(results).every(Boolean);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
