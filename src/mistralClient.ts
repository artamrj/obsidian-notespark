import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { cleanGeneratedText } from "./output";
import type { NoteSparkSettings, ResolvedPrompt } from "./types";

export type Requester = (request: RequestUrlParam | string) => Promise<RequestUrlResponse>;

interface MistralContentChunk {
  type?: string;
  text?: string;
}

export class NoteSparkGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteSparkGenerationError";
  }
}

export async function generateQuote(
  settings: NoteSparkSettings,
  prompt: ResolvedPrompt,
  requester: Requester,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new NoteSparkGenerationError("Add a Mistral API key in NoteSpark settings first.");
  }

  const response = await withTimeout(
    requester({
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You generate concise, original quotes, reflections, or writing prompts. Return only the final text. Do not include markdown, labels, explanations, or surrounding quotation marks.",
          },
          {
            role: "user",
            content: `${prompt.prompt}\n\nKeep the answer within ${prompt.maxLength} characters.`,
          },
        ],
      }),
    }),
    settings.requestTimeoutMs,
  );

  if (response.status < 200 || response.status >= 300) {
    throw new NoteSparkGenerationError(getErrorMessage(response));
  }

  const content = extractContent(response.json);
  if (!content.trim()) {
    throw new NoteSparkGenerationError("Mistral response did not include generated content.");
  }

  return cleanGeneratedText(content, prompt.maxLength);
}

function extractContent(data: unknown): string {
  const response = data as {
    choices?: Array<{
      message?: {
        content?: string | MistralContentChunk[];
      };
    }>;
  };

  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (chunk.type && chunk.type !== "text") {
          return "";
        }

        return typeof chunk.text === "string" ? chunk.text : "";
      })
      .join("");
  }

  return "";
}

function getErrorMessage(response: RequestUrlResponse): string {
  const json = response.json as { message?: string; error?: string | { message?: string } } | undefined;

  if (typeof json?.error === "string") {
    return `Mistral request failed: ${json.error}`;
  }

  if (typeof json?.error?.message === "string") {
    return `Mistral request failed: ${json.error.message}`;
  }

  if (typeof json?.message === "string") {
    return `Mistral request failed: ${json.message}`;
  }

  return `Mistral request failed with HTTP ${response.status}.`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new NoteSparkGenerationError(`Mistral request timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    if (error instanceof NoteSparkGenerationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown network error.";
    throw new NoteSparkGenerationError(`Mistral request failed: ${message}`);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

