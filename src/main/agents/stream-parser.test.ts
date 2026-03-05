import { describe, expect, it } from "vitest";
import { StreamParser } from "./stream-parser";

describe("StreamParser", () => {
  it("parses a complete JSON line", () => {
    const parser = new StreamParser();
    const results = parser.feed('{"type":"system","subtype":"init"}\n');
    expect(results).toEqual([{ type: "system", subtype: "init" }]);
  });

  it("buffers incomplete lines across chunks", () => {
    const parser = new StreamParser();
    expect(parser.feed('{"typ')).toEqual([]);
    expect(parser.feed('e":"system"}\n')).toEqual([{ type: "system" }]);
  });

  it("handles multiple complete lines in one chunk", () => {
    const parser = new StreamParser();
    const results = parser.feed('{"a":1}\n{"b":2}\n');
    expect(results).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("handles empty lines gracefully", () => {
    const parser = new StreamParser();
    const results = parser.feed('\n\n{"a":1}\n\n');
    expect(results).toEqual([{ a: 1 }]);
  });

  it("skips malformed JSON lines and continues", () => {
    const parser = new StreamParser();
    const results = parser.feed('not json\n{"a":1}\n');
    expect(results).toEqual([{ a: 1 }]);
  });

  it("handles a chunk that ends mid-line without newline", () => {
    const parser = new StreamParser();
    expect(parser.feed('{"a":1}\n{"b":')).toEqual([{ a: 1 }]);
    expect(parser.feed("2}\n")).toEqual([{ b: 2 }]);
  });

  it("handles carriage return + newline (Windows-style)", () => {
    const parser = new StreamParser();
    const results = parser.feed('{"a":1}\r\n{"b":2}\r\n');
    expect(results).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("resets buffer state via reset()", () => {
    const parser = new StreamParser();
    parser.feed('{"incomp');
    parser.reset();
    const results = parser.feed('{"a":1}\n');
    expect(results).toEqual([{ a: 1 }]);
  });
});
