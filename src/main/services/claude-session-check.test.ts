import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeSessionExistsOnDisk, computeClaudeProjectHash } from "./claude-session-check.js";

describe("computeClaudeProjectHash", () => {
  it("replaces slashes with dashes", () => {
    const hash = computeClaudeProjectHash("/Users/test/dev/myproject");
    expect(hash).toBe("-Users-test-dev-myproject");
  });

  it("handles root path", () => {
    const hash = computeClaudeProjectHash("/");
    expect(hash).toBe("-");
  });

  it("handles paths with multiple consecutive slashes", () => {
    const hash = computeClaudeProjectHash("/Users//test");
    expect(hash).toBe("-Users--test");
  });
});

describe("claudeSessionExistsOnDisk", () => {
  it("returns true when session file exists", () => {
    const tempClaudeDir = mkdtempSync(join(tmpdir(), "claude-check-test-"));
    const projectHash = "-fake-project-path";
    const sessionId = "abc-123-def";
    const projectDir = join(tempClaudeDir, "projects", projectHash);
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, `${sessionId}.jsonl`), "{}");

    const result = claudeSessionExistsOnDisk("/fake/project/path", sessionId, tempClaudeDir);
    expect(result).toBe(true);
  });

  it("returns false when session file does not exist", () => {
    const tempClaudeDir = mkdtempSync(join(tmpdir(), "claude-check-test-"));
    const projectHash = "-fake-project-path";
    const projectDir = join(tempClaudeDir, "projects", projectHash);
    mkdirSync(projectDir, { recursive: true });

    const result = claudeSessionExistsOnDisk("/fake/project/path", "nonexistent-id", tempClaudeDir);
    expect(result).toBe(false);
  });

  it("returns false when project directory does not exist", () => {
    const tempClaudeDir = mkdtempSync(join(tmpdir(), "claude-check-test-"));

    const result = claudeSessionExistsOnDisk("/fake/project/path", "some-id", tempClaudeDir);
    expect(result).toBe(false);
  });
});
