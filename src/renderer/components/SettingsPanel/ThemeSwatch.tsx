import type { ThemeDefinition } from "../../themes";

const PREVIEW_KEYS = ["base", "sidebar", "accent", "text-primary", "surface"] as const;

interface ThemeSwatchProps {
  theme: ThemeDefinition;
  isActive: boolean;
  onClick: () => void;
}

export function ThemeSwatch({ theme, isActive, onClick }: ThemeSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${theme.name} theme`}
      className={`flex flex-col items-center gap-2 rounded-lg p-3 transition-all cursor-pointer
        ${isActive ? "ring-2 ring-accent bg-surface" : "bg-surface/50 hover:bg-surface"}`}
    >
      <div className="flex gap-1.5">
        {PREVIEW_KEYS.map((key) => (
          <div
            key={key}
            className="w-5 h-5 rounded-full border border-border-subtle"
            style={{ backgroundColor: theme.colors[key] }}
          />
        ))}
      </div>
      <span className="text-xs text-text-secondary">{theme.name}</span>
    </button>
  );
}
