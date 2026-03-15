import type { AgentType } from "../../shared/agent-types.js";

type SidebandStatus = "running" | "waiting_for_input";
type StatusCallback = (status: SidebandStatus) => void;

const DEFAULT_IDLE_TIMEOUT_MS = 500;

/**
 * Detects whether a PTY-based agent is running or waiting for input.
 *
 * Uses an idle timer: any incoming data means "running", and after
 * a configurable period of silence the status flips to "waiting_for_input".
 * This is far more robust than regex-based prompt detection because
 * TUI apps (like Claude Code) use cursor positioning that makes
 * stripped output unparseable.
 */
export class SidebandDetector {
  private currentStatus: SidebandStatus = "running";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStatusChange?: StatusCallback;
  private readonly idleTimeoutMs: number;

  constructor(_agentType: AgentType, onStatusChange?: StatusCallback, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS) {
    this.onStatusChange = onStatusChange;
    this.idleTimeoutMs = idleTimeoutMs;
  }

  get status(): SidebandStatus {
    return this.currentStatus;
  }

  feed(_rawData: string): void {
    this.setStatus("running");

    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.setStatus("waiting_for_input");
    }, this.idleTimeoutMs);
  }

  dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setStatus(status: SidebandStatus): void {
    if (status !== this.currentStatus) {
      this.currentStatus = status;
      this.onStatusChange?.(status);
    }
  }
}
