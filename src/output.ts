import { normalizeCalloutType } from "./settings";
import type { NoteSparkSettings, ResolvedPrompt } from "./types";

export function cleanGeneratedText(text: string, maxLength: number): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/^```[\s\S]*?\n/, "")
    .replace(/\n```$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*>\s?/, "").trimEnd())
    .join("\n")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trimEnd();
}

export function formatOutput(
  generatedText: string,
  settings: NoteSparkSettings,
  prompt: ResolvedPrompt,
): string {
  const text = cleanGeneratedText(generatedText, prompt.maxLength);

  if (settings.outputMode === "plain") {
    return text;
  }

  const calloutType = normalizeCalloutType(prompt.calloutType, settings.defaultCalloutType);
  const quoteLines = text.split("\n").map((line) => `> ${line}`);

  return [`> [!${calloutType}]`, ...quoteLines].join("\n");
}
