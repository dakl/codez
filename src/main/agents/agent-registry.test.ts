import { describe, expect, it } from "vitest";
import { createAdapter } from "./agent-registry";
import { ClaudeAdapter } from "./claude-adapter";

describe("createAdapter", () => {
  it("returns a ClaudeAdapter for agent type 'claude'", () => {
    const adapter = createAdapter({
      agentType: "claude",
      sessionId: "sess-1",
      worktreePath: "/tmp/wt",
    });
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it("throws for unknown agent type", () => {
    expect(() =>
      createAdapter({
        agentType: "mistral" as never,
        sessionId: "sess-1",
        worktreePath: "/tmp/wt",
      }),
    ).toThrow("No adapter available for agent type: mistral");
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
});
