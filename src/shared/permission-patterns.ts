/**
 * Derive a --allowedTools pattern from a tool name and its input.
 *
 * For Bash: extracts the first word of the command as a prefix glob.
 *   e.g. "git commit -m 'fix'" → "Bash(git *)"
 * For other tools: returns the bare tool name.
 *   e.g. "Edit" → "Edit"
 */
export function deriveToolPattern(toolName: string, toolInput: Record<string, unknown>): string {
  if (toolName === "Bash" && typeof toolInput.command === "string") {
    const command = toolInput.command.trim();
    const firstWord = command.split(/\s+/)[0];
    if (firstWord) {
      return `Bash(${firstWord} *)`;
    }
  }
  return toolName;
}
