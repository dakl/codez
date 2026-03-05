import type { AgentType } from "../../shared/agent-types.js";
import { ClaudeAdapter } from "./claude-adapter.js";

interface CreateAdapterOptions {
  agentType: AgentType;
  sessionId: string;
  worktreePath: string;
  allowedTools?: string[];
  additionalDirs?: string[];
  permissionMode?: string;
}

export function createAdapter(options: CreateAdapterOptions): ClaudeAdapter {
  switch (options.agentType) {
    case "claude":
      return new ClaudeAdapter({
        sessionId: options.sessionId,
        worktreePath: options.worktreePath,
        allowedTools: options.allowedTools,
        additionalDirs: options.additionalDirs,
        permissionMode: options.permissionMode as "default" | "acceptEdits" | "bypassPermissions" | "plan",
      });
    default:
      throw new Error(`No adapter available for agent type: ${options.agentType}`);
  }
}
