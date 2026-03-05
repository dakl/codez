import { describe, expect, it } from "vitest";
import { deriveToolPattern } from "./permission-patterns";

describe("deriveToolPattern", () => {
  it("extracts first word from Bash command as glob prefix", () => {
    expect(deriveToolPattern("Bash", { command: "git commit -m 'fix'" })).toBe("Bash(git *)");
  });

  it("handles single-word Bash commands", () => {
    expect(deriveToolPattern("Bash", { command: "ls" })).toBe("Bash(ls *)");
  });

  it("handles npm commands", () => {
    expect(deriveToolPattern("Bash", { command: "npm run test" })).toBe("Bash(npm *)");
  });

  it("trims whitespace from Bash commands", () => {
    expect(deriveToolPattern("Bash", { command: "  git status  " })).toBe("Bash(git *)");
  });

  it("falls back to bare tool name when Bash has no command string", () => {
    expect(deriveToolPattern("Bash", {})).toBe("Bash");
    expect(deriveToolPattern("Bash", { command: 123 })).toBe("Bash");
  });

  it("falls back to bare tool name for empty Bash command", () => {
    expect(deriveToolPattern("Bash", { command: "   " })).toBe("Bash");
  });

  it("returns bare tool name for non-Bash tools", () => {
    expect(deriveToolPattern("Edit", { file_path: "/tmp/foo.ts" })).toBe("Edit");
    expect(deriveToolPattern("Write", { file_path: "/tmp/bar.ts" })).toBe("Write");
    expect(deriveToolPattern("Read", { file_path: "/tmp/baz.ts" })).toBe("Read");
  });
});
