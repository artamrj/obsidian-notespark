import type { NoteSparkTrigger } from "./types";

const TRIGGER_PATTERN = /^@notespark(?:\[(\d+)])?$/;

interface FenceState {
  marker: "`" | "~";
  length: number;
}

export function findNoteSparkTriggers(content: string): NoteSparkTrigger[] {
  const triggers: NoteSparkTrigger[] = [];
  const lines = content.split("\n");
  let offset = 0;
  let fence: FenceState | null = null;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const rawLine = lines[lineNumber] ?? "";
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const fenceDelimiter = getFenceDelimiter(line);

    if (fenceDelimiter) {
      if (!fence) {
        fence = fenceDelimiter;
      } else if (
        fence.marker === fenceDelimiter.marker &&
        fenceDelimiter.length >= fence.length
      ) {
        fence = null;
      }

      offset += rawLine.length + (lineNumber < lines.length - 1 ? 1 : 0);
      continue;
    }

    if (!fence) {
      const trimmed = line.trim();
      const match = trimmed.match(TRIGGER_PATTERN);

      if (match) {
        triggers.push({
          start: offset,
          end: offset + line.length,
          line: lineNumber,
          raw: trimmed,
          presetId: match[1] ? Number(match[1]) : undefined,
        });
      }
    }

    offset += rawLine.length + (lineNumber < lines.length - 1 ? 1 : 0);
  }

  return triggers;
}

export function hasNoteSparkTrigger(content: string): boolean {
  return findNoteSparkTriggers(content).length > 0;
}

export function offsetToPosition(content: string, offset: number): { line: number; ch: number } {
  const boundedOffset = Math.max(0, Math.min(content.length, offset));
  let line = 0;
  let lineStart = 0;

  for (let index = 0; index < boundedOffset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
      lineStart = index + 1;
    }
  }

  return {
    line,
    ch: boundedOffset - lineStart,
  };
}

function getFenceDelimiter(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})/);

  if (!match) {
    return null;
  }

  const token = match[1];
  return {
    marker: token[0] as "`" | "~",
    length: token.length,
  };
}

