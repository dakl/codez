import type { ThemeId } from "@shared/types";
import { describe, expect, it } from "vitest";
import { THEME_CSS_KEYS, themes } from "./themes";

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

describe("themes", () => {
  it("defines exactly 6 themes", () => {
    expect(themes).toHaveLength(6);
  });

  it("has 3 dark and 3 light themes", () => {
    const dark = themes.filter((t) => t.mode === "dark");
    const light = themes.filter((t) => t.mode === "light");
    expect(dark).toHaveLength(3);
    expect(light).toHaveLength(3);
  });

  it("every theme has a unique id", () => {
    const ids = themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(themes.length);
  });

  it("every theme has all required CSS color keys", () => {
    for (const theme of themes) {
      for (const key of THEME_CSS_KEYS) {
        expect(theme.colors).toHaveProperty(key);
      }
    }
  });

  it("every color value is a valid hex code", () => {
    for (const theme of themes) {
      for (const [key, value] of Object.entries(theme.colors)) {
        expect(value, `${theme.id}.${key}`).toMatch(HEX_PATTERN);
      }
    }
  });

  it("every theme has a non-empty name", () => {
    for (const theme of themes) {
      expect(theme.name.length).toBeGreaterThan(0);
    }
  });

  it("includes the expected theme IDs", () => {
    const ids = themes.map((t) => t.id);
    const expected: ThemeId[] = ["midnight", "ember", "forest", "snow", "sand", "dawn"];
    expect(ids).toEqual(expect.arrayContaining(expected));
  });
});
