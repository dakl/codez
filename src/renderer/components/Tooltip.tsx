import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const HOVER_DELAY_MS = 400;
const GAP = 6;

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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(false);
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!hovered || !triggerRef.current) return;

    // Defer position calculation so the portal tooltip is in the DOM
    requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const rect = trigger.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();

      let top = 0;
      let left = 0;

      if (position === "above") {
        top = rect.top - tipRect.height - GAP;
        left = align === "end" ? rect.right - tipRect.width : rect.left + rect.width / 2 - tipRect.width / 2;
      } else if (position === "right") {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.right + GAP;
      } else {
        top = rect.bottom + GAP;
        left = align === "end" ? rect.right - tipRect.width : rect.left + rect.width / 2 - tipRect.width / 2;
      }

      setCoords({ top, left });
    });
  }, [hovered, position, align]);

  const arrow = { below: ARROW_UP, above: ARROW_DOWN, right: ARROW_LEFT }[position];

  const pill = (
    <span className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium leading-none bg-elevated text-text-primary shadow-lg border border-border-subtle">
      {label}
    </span>
  );

  const flexDir = position === "right" ? "flex-row items-center" : "flex-col items-center";

  const tooltipContent = (
    <span
      ref={tooltipRef}
      className={`fixed pointer-events-none z-[9999] flex ${flexDir}`}
      style={{
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        opacity: coords ? 1 : 0,
        animation: coords ? "tooltip-fade-in 100ms ease-out" : undefined,
      }}
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
  );

  return (
    <span ref={triggerRef} className="relative inline-flex" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
      {hovered && createPortal(tooltipContent, document.body)}
    </span>
  );
}
