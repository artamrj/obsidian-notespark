import { describe, expect, it } from "vitest";
import { cleanGeneratedText, formatOutput } from "../src/output";
import { normalizeSettings, resolvePrompt } from "../src/settings";

describe("cleanGeneratedText", () => {
  it("trims text, removes blockquote markers, and enforces max length", () => {
    expect(cleanGeneratedText("  > Keep moving with care and focus.  ", 12)).toBe("Keep moving");
  });
});

describe("formatOutput", () => {
  it("formats generated text as an Obsidian callout by default", () => {
    const settings = normalizeSettings({});
    const prompt = resolvePrompt(settings);

    expect(formatOutput("Start small.", settings, prompt!)).toBe(
      ["> [!quote]", "> Start small."].join("\n"),
    );
  });

  it("uses preset callout overrides", () => {
    const settings = normalizeSettings({
      presets: [
        {
          id: 1,
          prompt: "Make a useful prompt.",
          maxLength: 100,
          calloutType: "tip",
        },
      ],
    });
    const prompt = resolvePrompt(settings, 1);

    expect(formatOutput("Name the next step.", settings, prompt!)).toBe(
      ["> [!tip]", "> Name the next step."].join("\n"),
    );
  });

  it("supports plain text output", () => {
    const settings = normalizeSettings({ outputMode: "plain" });
    const prompt = resolvePrompt(settings);

    expect(formatOutput("Only the text.", settings, prompt!)).toBe("Only the text.");
  });
});

