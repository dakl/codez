export class StreamParser {
  private buffer = "";

  feed(chunk: string): Record<string, unknown>[] {
    this.buffer += chunk;
    const results: Record<string, unknown>[] = [];
    const lines = this.buffer.split("\n");

    // Last element is either empty (if chunk ended with \n) or an incomplete line
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, "").trim();
      if (trimmed.length === 0) continue;

      try {
        results.push(JSON.parse(trimmed));
      } catch {
        // Skip malformed lines
      }
    }

    return results;
  }

  reset(): void {
    this.buffer = "";
  }
}
