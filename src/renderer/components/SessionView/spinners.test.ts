import { describe, expect, it } from "vitest";
import { SPINNERS, getRandomSpinner } from "./spinners";

describe("SPINNERS", () => {
  it("contains multiple spinner definitions", () => {
    expect(SPINNERS.length).toBeGreaterThan(5);
  });

  it("each spinner has a name, frames array, and interval", () => {
    for (const spinner of SPINNERS) {
      expect(spinner.name).toBeTruthy();
      expect(spinner.frames.length).toBeGreaterThan(1);
      expect(spinner.intervalMs).toBeGreaterThan(0);
    }
  });

  it("every frame is a non-empty string", () => {
    for (const spinner of SPINNERS) {
      for (const frame of spinner.frames) {
        expect(typeof frame).toBe("string");
        expect(frame.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getRandomSpinner", () => {
  it("returns a spinner from the SPINNERS list", () => {
    const spinner = getRandomSpinner();
    expect(SPINNERS).toContainEqual(spinner);
  });

  it("eventually returns different spinners across many calls", () => {
    const names = new Set<string>();
    for (let i = 0; i < 200; i++) {
      names.add(getRandomSpinner().name);
    }
    expect(names.size).toBeGreaterThan(1);
  });
});
