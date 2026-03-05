import { describe, expect, it } from "vitest";
import { isSettingsShortcut } from "./useGlobalShortcuts";

describe("isSettingsShortcut", () => {
  it("returns true for Cmd+,", () => {
    const event = { key: ",", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
    expect(isSettingsShortcut(event as KeyboardEvent)).toBe(true);
  });

  it("returns false when meta is not held", () => {
    const event = { key: ",", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(isSettingsShortcut(event as KeyboardEvent)).toBe(false);
  });

  it("returns false for Cmd+other key", () => {
    const event = { key: "k", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
    expect(isSettingsShortcut(event as KeyboardEvent)).toBe(false);
  });

  it("returns false when shift is also held", () => {
    const event = { key: ",", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false };
    expect(isSettingsShortcut(event as KeyboardEvent)).toBe(false);
  });

  it("returns false when alt is also held", () => {
    const event = { key: ",", metaKey: true, ctrlKey: false, shiftKey: false, altKey: true };
    expect(isSettingsShortcut(event as KeyboardEvent)).toBe(false);
  });
});
