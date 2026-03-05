import { useEffect, useMemo, useState } from "react";
import { getRandomSpinner } from "./spinners";

interface ThinkingIndicatorProps {
  text?: string;
}

export function ThinkingIndicator({ text }: ThinkingIndicatorProps) {
  const spinner = useMemo(() => getRandomSpinner(), []);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % spinner.frames.length);
    }, spinner.intervalMs);
    return () => clearInterval(timer);
  }, [spinner]);

  const hasText = text && text.length > 0;

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-surface/60 border border-border-subtle">
        <button
          type="button"
          onClick={() => hasText && setIsExpanded(!isExpanded)}
          title={hasText ? (isExpanded ? "Collapse thinking" : "Expand thinking") : undefined}
          className={`flex items-center gap-1.5 text-xs text-text-muted ${hasText ? "hover:text-text-secondary cursor-pointer" : "cursor-default"} transition-colors`}
        >
          <span className="font-mono">{spinner.frames[frameIndex]}</span>
          <span className="font-medium">Thinking…</span>
          {hasText && (
            <span className={`transition-transform duration-150 text-[10px] ml-1 ${isExpanded ? "rotate-90" : ""}`}>▶</span>
          )}
        </button>
        {hasText && isExpanded && (
          <div className="mt-2 text-text-muted text-xs leading-relaxed whitespace-pre-wrap break-words select-text cursor-text italic max-h-60 overflow-y-auto">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
