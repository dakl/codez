import { describe, expect, test } from "vitest";
import { formatReleaseNotes, stripHtml } from "./updater.js";

describe("stripHtml", () => {
  test("removes simple HTML tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  test("converts <br> to newlines", () => {
    expect(stripHtml("line1<br>line2<br/>line3")).toBe("line1\nline2\nline3");
  });

  test("converts closing </li> to newlines", () => {
    expect(stripHtml("<ul><li>one</li><li>two</li></ul>")).toBe("one\ntwo");
  });

  test("converts closing heading tags to newlines", () => {
    expect(stripHtml("<h2>Title</h2><p>body</p>")).toBe("Title\nbody");
  });

  test("decodes HTML entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#39;")).toBe("& < > \" '");
  });

  test("collapses excessive newlines", () => {
    expect(stripHtml("a<br><br><br><br>b")).toBe("a\n\nb");
  });

  test("trims whitespace", () => {
    expect(stripHtml("  <p>hello</p>  ")).toBe("hello");
  });

  test("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  test("passes through plain text unchanged", () => {
    expect(stripHtml("just plain text")).toBe("just plain text");
  });
});

describe("formatReleaseNotes", () => {
  test("returns undefined for null", () => {
    expect(formatReleaseNotes(null)).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(formatReleaseNotes(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(formatReleaseNotes("")).toBeUndefined();
  });

  test("strips HTML from string input", () => {
    expect(formatReleaseNotes("<p>Bug fixes</p>")).toBe("Bug fixes");
  });

  test("formats array of release note objects", () => {
    const notes = [
      { version: "1.2.0", note: "<p>New feature</p>" },
      { version: "1.1.0", note: "<p>Bug fix</p>" },
    ];
    expect(formatReleaseNotes(notes)).toBe("1.2.0: New feature\n\n1.1.0: Bug fix");
  });

  test("handles array with missing note field", () => {
    const notes = [{ version: "1.0.0" }];
    expect(formatReleaseNotes(notes)).toBe("1.0.0: ");
  });
});
