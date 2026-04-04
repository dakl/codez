import type { AgentType } from "../../shared/agent-types.js";
import { ClaudeAdapter } from "./claude-adapter.js";

interface CreateAdapterOptions {
  agentType: AgentType;
  sessionId: string;
  worktreePath: string;
  additionalDirs?: string[];
  extraArgs?: string[];
}

export function createAdapter(options: CreateAdapterOptions): ClaudeAdapter {
  switch (options.agentType) {
    case "claude":
      return new ClaudeAdapter({
        sessionId: options.sessionId,
        worktreePath: options.worktreePath,
        additionalDirs: options.additionalDirs,
        extraArgs: options.extraArgs,
      });
    default:
      throw new Error(`No adapter available for agent type: ${options.agentType}`);
  }
}
