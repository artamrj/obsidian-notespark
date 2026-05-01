import { describe, expect, it } from "vitest";
import { normalizeSettings, resolvePrompt } from "../src/settings";

describe("normalizeSettings", () => {
  it("applies defaults and clamps invalid values", () => {
    const settings = normalizeSettings({
      model: "",
      temperature: 7,
      maxTokens: -1,
      requestTimeoutMs: 50,
      outputMode: "plain",
      defaultCalloutType: "daily note!",
      presets: [],
    });

    expect(settings.model).toBe("mistral-small-latest");
    expect(settings.temperature).toBe(2);
    expect(settings.maxTokens).toBe(1);
    expect(settings.requestTimeoutMs).toBe(1000);
    expect(settings.outputMode).toBe("plain");
    expect(settings.defaultCalloutType).toBe("daily-note");
    expect(settings.presets).toHaveLength(0);
  });

  it("uses default presets when no saved preset list exists", () => {
    expect(normalizeSettings({}).presets).toHaveLength(3);
  });
});

describe("resolvePrompt", () => {
  it("resolves the default prompt and known presets", () => {
    const settings = normalizeSettings({
      defaultPrompt: "Default reflection",
      defaultMaxLength: 90,
      presets: [
        {
          id: 7,
          prompt: "Preset reflection",
          maxLength: 80,
          calloutType: "tip",
        },
      ],
    });

    expect(resolvePrompt(settings)).toMatchObject({
      label: "Default prompt",
      prompt: "Default reflection",
      maxLength: 90,
    });
    expect(resolvePrompt(settings, 7)).toMatchObject({
      id: 7,
      label: "Preset 7",
      prompt: "Preset reflection",
      maxLength: 80,
      calloutType: "tip",
    });
    expect(resolvePrompt(settings, 99)).toBeNull();
  });
});
