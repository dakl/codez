import { describe, expect, it } from "vitest";
import { parseEnvOutput } from "./shell-env";

describe("parseEnvOutput", () => {
  it("parses simple KEY=VALUE lines", () => {
    const output = "PATH=/usr/local/bin:/usr/bin\nHOME=/Users/dan\n";
    expect(parseEnvOutput(output)).toEqual({
      PATH: "/usr/local/bin:/usr/bin",
      HOME: "/Users/dan",
    });
  });

  it("preserves equals signs in values", () => {
    const output = "SOME_VAR=foo=bar=baz\n";
    expect(parseEnvOutput(output)).toEqual({ SOME_VAR: "foo=bar=baz" });
  });

  it("skips lines without an equals sign", () => {
    const output = "not_an_env_var\nKEY=value\n";
    expect(parseEnvOutput(output)).toEqual({ KEY: "value" });
  });

  it("skips lines that look like shell output noise", () => {
    const output = "[oh-my-zsh] loading...\nPATH=/usr/bin\n  indented=bad\n";
    expect(parseEnvOutput(output)).toEqual({ PATH: "/usr/bin" });
  });

  it("handles empty values", () => {
    const output = "EMPTY=\n";
    expect(parseEnvOutput(output)).toEqual({ EMPTY: "" });
  });

  it("handles empty input", () => {
    expect(parseEnvOutput("")).toEqual({});
  });

  it("allows lowercase and mixed-case keys", () => {
    const output = "myVar=value\nMY_VAR=other\n";
    expect(parseEnvOutput(output)).toEqual({ myVar: "value", MY_VAR: "other" });
  });
});
