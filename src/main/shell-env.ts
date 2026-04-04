import { execSync } from "node:child_process";
import { homedir } from "node:os";

// Only include lines that look like valid env var assignments (KEY=value).
// This filters out any stdout noise from .zshrc initialization.
const ENV_LINE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=/;

export function parseEnvOutput(output: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of output.split("\n")) {
    if (!ENV_LINE_PATTERN.test(line)) continue;
    const eqIndex = line.indexOf("=");
    env[line.slice(0, eqIndex)] = line.slice(eqIndex + 1);
  }
  return env;
}

let cachedEnv: Record<string, string> | null = null;

export function getShellEnv(): Record<string, string> {
  if (cachedEnv !== null) return cachedEnv;

  const shell = process.env.SHELL ?? "/bin/zsh";
  const rcFile = `${homedir()}/.zshrc`;
  // Login shell sources .zprofile (PATH, brew, etc.).
  // Explicitly source .zshrc for interactive env vars — silencing errors
  // since some .zshrc hooks fail outside a true interactive terminal.
  const command = `source ${rcFile} 2>/dev/null; printenv`;
  try {
    const output = execSync(`${shell} -l -c '${command}'`, {
      timeout: 10_000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    cachedEnv = parseEnvOutput(output);
  } catch {
    cachedEnv = {};
  }

  return cachedEnv;
}
