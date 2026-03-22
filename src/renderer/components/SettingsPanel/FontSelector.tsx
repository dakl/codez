import type { FontInfo } from "@shared/types";

interface FontSelectorProps {
  label: string;
  value: string;
  fonts: FontInfo[];
  onChange: (font: string) => void;
}

export function FontSelector({ label, value, fonts, onChange }: FontSelectorProps) {
  const bundledNames = new Set(["Geist", "Geist Mono"]);

  const bundledFonts = fonts.filter((f) => bundledNames.has(f.familyName));
  const systemMono = fonts
    .filter((f) => !bundledNames.has(f.familyName) && f.monospace)
    .sort((a, b) => a.familyName.localeCompare(b.familyName));
  const systemOther = fonts
    .filter((f) => !bundledNames.has(f.familyName) && !f.monospace)
    .sort((a, b) => a.familyName.localeCompare(b.familyName));

  return (
    <div>
      <label className="block text-[11px] text-text-muted mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full text-sm bg-surface border border-border-subtle rounded-md px-3 py-1.5 text-text-primary cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
        style={{ fontFamily: `"${value}", sans-serif` }}
      >
        {bundledFonts.length > 0 && (
          <optgroup label="Bundled">
            {bundledFonts.map((font) => (
              <option key={font.familyName} value={font.familyName}>
                {font.familyName}
              </option>
            ))}
          </optgroup>
        )}
        {systemMono.length > 0 && (
          <optgroup label="System Monospace">
            {systemMono.map((font) => (
              <option key={font.familyName} value={font.familyName}>
                {font.familyName}
              </option>
            ))}
          </optgroup>
        )}
        {systemOther.length > 0 && (
          <optgroup label="System">
            {systemOther.map((font) => (
              <option key={font.familyName} value={font.familyName}>
                {font.familyName}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
