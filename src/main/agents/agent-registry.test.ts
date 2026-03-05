import { describe, expect, it } from "vitest";
import { createAdapter } from "./agent-registry";
import { ClaudeAdapter } from "./claude-adapter";
import { MistralAdapter } from "./mistral-adapter";

describe("createAdapter", () => {
  it("returns a ClaudeAdapter for agent type 'claude'", () => {
    const adapter = createAdapter({
      agentType: "claude",
      sessionId: "sess-1",
      worktreePath: "/tmp/wt",
    });
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it("returns a MistralAdapter for agent type 'mistral'", () => {
    const adapter = createAdapter({
      agentType: "mistral",
      sessionId: "sess-1",
      worktreePath: "/tmp/wt",
    });
    expect(adapter).toBeInstanceOf(MistralAdapter);
  });

  it("throws for unknown agent type", () => {
    expect(() =>
      createAdapter({
        agentType: "gemini" as never,
        sessionId: "sess-1",
        worktreePath: "/tmp/wt",
      }),
    ).toThrow("No adapter available for agent type: gemini");
  });

  it("passes sessionId and worktreePath to the adapter", () => {
    const adapter = createAdapter({
      agentType: "claude",
      sessionId: "my-session",
      worktreePath: "/my/worktree",
    });
    // Verify by building args — sessionId should appear
    const args = adapter.buildStartArgs("test");
    expect(args).toContain("my-session");
  });

  it("Mistral adapter builds correct arguments", () => {
    const adapter = createAdapter({
      agentType: "mistral",
      sessionId: "test-session",
      worktreePath: "/test/worktree",
    });
    const args = adapter.buildStartArgs("hello world");
    expect(args).toContain("-p");
    expect(args.some((arg) => arg.includes("hello world"))).toBe(true);
    // streaming is now a positional argument after -p
    expect(args).toContain("streaming");
    // Note: vibe doesn't support --session-id for new sessions like claude does
  });
});
