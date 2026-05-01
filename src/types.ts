export type NoteSparkOutputMode = "callout" | "plain";

export interface PromptPreset {
  id: number;
  prompt: string;
  maxLength: number;
  calloutType?: string;
}

export interface NoteSparkSettings {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  requestTimeoutMs: number;
  defaultPrompt: string;
  defaultMaxLength: number;
  outputMode: NoteSparkOutputMode;
  defaultCalloutType: string;
  autoGenerate: boolean;
  presets: PromptPreset[];
}

export interface ResolvedPrompt {
  id?: number;
  label: string;
  prompt: string;
  maxLength: number;
  calloutType?: string;
}

export interface NoteSparkTrigger {
  start: number;
  end: number;
  line: number;
  raw: string;
  presetId?: number;
}

export interface TextReplacement {
  start: number;
  end: number;
  text: string;
}

