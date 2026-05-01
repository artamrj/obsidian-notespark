import type { NoteSparkSettings, PromptPreset, ResolvedPrompt } from "./types";

export const DEFAULT_SETTINGS: NoteSparkSettings = {
  apiKey: "",
  model: "mistral-small-latest",
  temperature: 0.7,
  maxTokens: 120,
  requestTimeoutMs: 20000,
  defaultPrompt:
    "Generate one concise, original quote or reflection for a daily note. Keep it grounded, memorable, and useful.",
  defaultMaxLength: 140,
  outputMode: "callout",
  defaultCalloutType: "quote",
  autoGenerate: true,
  templateFolderPath: "",
  presets: [
    {
      id: 1,
      prompt: "Generate a motivational quote for studying.",
      maxLength: 120,
      calloutType: "quote",
    },
    {
      id: 2,
      prompt: "Generate a calm reflection for journaling.",
      maxLength: 180,
      calloutType: "quote",
    },
    {
      id: 3,
      prompt: "Generate a productivity-focused quote.",
      maxLength: 100,
      calloutType: "quote",
    },
  ],
};

export function normalizeSettings(data: Partial<NoteSparkSettings> | null | undefined): NoteSparkSettings {
  const raw = data ?? {};

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : DEFAULT_SETTINGS.apiKey,
    model: normalizeString(raw.model, DEFAULT_SETTINGS.model),
    temperature: clampNumber(raw.temperature, 0, 2, DEFAULT_SETTINGS.temperature),
    maxTokens: clampInteger(raw.maxTokens, 1, 4096, DEFAULT_SETTINGS.maxTokens),
    requestTimeoutMs: clampInteger(
      raw.requestTimeoutMs,
      1000,
      120000,
      DEFAULT_SETTINGS.requestTimeoutMs,
    ),
    defaultPrompt: normalizeString(raw.defaultPrompt, DEFAULT_SETTINGS.defaultPrompt),
    defaultMaxLength: clampInteger(
      raw.defaultMaxLength,
      1,
      2000,
      DEFAULT_SETTINGS.defaultMaxLength,
    ),
    outputMode: raw.outputMode === "plain" ? "plain" : "callout",
    defaultCalloutType: normalizeCalloutType(
      raw.defaultCalloutType,
      DEFAULT_SETTINGS.defaultCalloutType,
    ),
    autoGenerate: typeof raw.autoGenerate === "boolean" ? raw.autoGenerate : true,
    templateFolderPath: normalizeFolderPath(raw.templateFolderPath),
    presets: normalizePresets(raw.presets),
  };
}

export function resolvePrompt(settings: NoteSparkSettings, presetId?: number): ResolvedPrompt | null {
  if (presetId === undefined) {
    return {
      label: "Default prompt",
      prompt: settings.defaultPrompt,
      maxLength: settings.defaultMaxLength,
      calloutType: settings.defaultCalloutType,
    };
  }

  const preset = settings.presets.find((item) => item.id === presetId);
  if (!preset) {
    return null;
  }

  return {
    id: preset.id,
    label: `Preset ${preset.id}`,
    prompt: preset.prompt,
    maxLength: preset.maxLength,
    calloutType: preset.calloutType,
  };
}

export function getPromptChoices(settings: NoteSparkSettings): ResolvedPrompt[] {
  return [
    resolvePrompt(settings) as ResolvedPrompt,
    ...settings.presets
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((preset) => ({
        id: preset.id,
        label: `Preset ${preset.id}`,
        prompt: preset.prompt,
        maxLength: preset.maxLength,
        calloutType: preset.calloutType,
      })),
  ];
}

export function normalizeCalloutType(value: unknown, fallback = "quote"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function normalizeFolderPath(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

export function isFileInTemplateFolder(filePath: string, templateFolderPath: string): boolean {
  const folderPath = normalizeFolderPath(templateFolderPath);
  const normalizedFilePath = normalizeFolderPath(filePath);

  if (!folderPath || !normalizedFilePath) {
    return false;
  }

  return normalizedFilePath === folderPath || normalizedFilePath.startsWith(`${folderPath}/`);
}

function normalizePresets(value: unknown): PromptPreset[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SETTINGS.presets;
  }

  const seen = new Set<number>();
  const presets: PromptPreset[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const rawPreset = item as Partial<PromptPreset>;
    const id = clampInteger(rawPreset.id, 1, 9999, 0);
    const prompt = normalizeString(rawPreset.prompt, "");

    if (!id || !prompt || seen.has(id)) {
      continue;
    }

    seen.add(id);
    presets.push({
      id,
      prompt,
      maxLength: clampInteger(rawPreset.maxLength, 1, 2000, 140),
      calloutType:
        typeof rawPreset.calloutType === "string" && rawPreset.calloutType.trim()
          ? normalizeCalloutType(rawPreset.calloutType)
          : undefined,
    });
  }

  return presets.sort((a, b) => a.id - b.id);
}

function normalizeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
