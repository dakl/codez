import { type ReactNode, useCallback, useRef, useState } from "react";

const HOVER_DELAY_MS = 400;

interface TooltipProps {
  label: string;
  children: ReactNode;
  position?: "below" | "above" | "right";
  align?: "center" | "end";
}

const ARROW_UP = (
  <span className="block w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent border-b-4 border-b-elevated" />
);

const ARROW_DOWN = (
  <span className="block w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent border-t-4 border-t-elevated" />
);

const ARROW_LEFT = (
  <span className="block w-0 h-0 border-t-4 border-b-4 border-t-transparent border-b-transparent border-r-4 border-r-elevated" />
);

export function Tooltip({ label, children, position = "below", align = "center" }: TooltipProps) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(false);
  }, []);

  const isEnd = align === "end";

  const positionClasses = {
    below: isEnd ? "top-full right-0 mt-1" : "top-full left-1/2 mt-1",
    above: isEnd ? "bottom-full right-0 mb-1" : "bottom-full left-1/2 mb-1",
    right: "left-full top-1/2 ml-1",
  }[position];

  const transform = {
    below: isEnd ? undefined : "translateX(-50%)",
    above: isEnd ? undefined : "translateX(-50%)",
    right: "translateY(-50%)",
  }[position];

  const flexClasses = {
    below: isEnd ? "flex-col items-end" : "flex-col items-center",
    above: isEnd ? "flex-col items-end" : "flex-col items-center",
    right: "flex-row items-center",
  }[position];

  const arrow = { below: ARROW_UP, above: ARROW_DOWN, right: ARROW_LEFT }[position];

  const pill = (
    <span className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium leading-none bg-elevated text-text-primary shadow-lg border border-border-subtle">
      {label}
    </span>
  );

  return (
    <span className="relative inline-flex" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
      {hovered && (
        <span
          className={`absolute ${positionClasses} pointer-events-none z-50 flex ${flexClasses}`}
          style={{ transform, animation: "tooltip-fade-in 100ms ease-out" }}
        >
          {position === "above" ? (
            <>
              {pill}
              {arrow}
            </>
          ) : position === "right" ? (
            <>
              {arrow}
              {pill}
            </>
          ) : (
            <>
              {arrow}
              {pill}
            </>
          )}
        </span>
      )}
    </span>
  );
}
