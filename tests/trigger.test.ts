import { describe, expect, it } from "vitest";
import { findNoteSparkTriggers, offsetToPosition } from "../src/trigger";

describe("findNoteSparkTriggers", () => {
  it("finds standalone default and preset triggers", () => {
    const content = ["# Daily", "", "@notespark", "", "@notespark[3]"].join("\n");

    expect(findNoteSparkTriggers(content)).toEqual([
      {
        start: 9,
        end: 19,
        line: 2,
        raw: "@notespark",
        presetId: undefined,
      },
      {
        start: 21,
        end: 34,
        line: 4,
        raw: "@notespark[3]",
        presetId: 3,
      },
    ]);
  });

  it("ignores inline references and fenced code blocks", () => {
    const content = [
      "This mentions @notespark inline.",
      "",
      "```md",
      "@notespark[1]",
      "```",
      "",
      "@notespark[2]",
    ].join("\n");

    expect(findNoteSparkTriggers(content)).toEqual([
      {
        start: 59,
        end: 72,
        line: 6,
        raw: "@notespark[2]",
        presetId: 2,
      },
    ]);
  });
});

describe("offsetToPosition", () => {
  it("converts offsets into editor positions", () => {
    expect(offsetToPosition("one\ntwo\nthree", 8)).toEqual({ line: 2, ch: 0 });
    expect(offsetToPosition("one\ntwo\nthree", 11)).toEqual({ line: 2, ch: 3 });
  });
});
