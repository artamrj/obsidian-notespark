import {
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  requestUrl,
  type EditorPosition,
  type MarkdownFileInfo,
  type TFile,
} from "obsidian";
import { generateQuote, NoteSparkGenerationError } from "./mistralClient";
import { formatOutput } from "./output";
import { PromptPickerModal } from "./regenerateModal";
import {
  getPromptChoices,
  isFileInTemplateFolder,
  normalizeSettings,
  resolvePrompt,
} from "./settings";
import { NoteSparkSettingTab } from "./settingsTab";
import { findNoteSparkTriggers, hasNoteSparkTrigger, offsetToPosition } from "./trigger";
import type { NoteSparkSettings, ResolvedPrompt, TextReplacement } from "./types";

interface ReplacementTarget {
  from: EditorPosition;
  to: EditorPosition;
}

export default class NoteSparkPlugin extends Plugin {
  settings!: NoteSparkSettings;
  private autoGenerateTimer: ReturnType<typeof setTimeout> | null = null;
  private processingFiles = new Set<string>();

  async onload(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());

    this.addSettingTab(new NoteSparkSettingTab(this));

    this.addCommand({
      id: "generate-active-note",
      name: "Generate triggers in active note",
      editorCallback: async (editor, view) => {
        if (!view.file) {
          new Notice("Open a markdown note before generating NoteSpark triggers.");
          return;
        }

        await this.replaceTriggersInEditor(editor, view, false);
      },
    });

    this.addCommand({
      id: "regenerate-quote",
      name: "Regenerate quote",
      editorCallback: (editor, view) => {
        if (view.file && this.shouldIgnoreFile(view.file)) {
          new Notice("NoteSpark is disabled inside the configured template folder.");
          return;
        }

        this.openRegeneratePromptPicker(editor);
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.scheduleActiveFileGeneration();
      }),
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.scheduleActiveFileGeneration();
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, view) => {
        if (view.file) {
          this.scheduleAutoGeneration(editor, view);
        }
      }),
    );

    this.app.workspace.onLayoutReady(() => {
      this.scheduleActiveFileGeneration();
    });
  }

  onunload(): void {
    if (this.autoGenerateTimer) {
      clearTimeout(this.autoGenerateTimer);
      this.autoGenerateTimer = null;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private scheduleActiveFileGeneration(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      return;
    }

    this.scheduleAutoGeneration(view.editor, view);
  }

  private scheduleAutoGeneration(editor: Editor, view: MarkdownFileInfo): void {
    if (!this.settings.autoGenerate || !view.file || !hasNoteSparkTrigger(editor.getValue())) {
      return;
    }

    if (this.shouldIgnoreFile(view.file)) {
      return;
    }

    if (this.autoGenerateTimer) {
      clearTimeout(this.autoGenerateTimer);
    }

    this.autoGenerateTimer = setTimeout(() => {
      void this.replaceTriggersInEditor(editor, view, true);
    }, 1000);
  }

  private async replaceTriggersInEditor(
    editor: Editor,
    view: MarkdownFileInfo,
    automatic: boolean,
  ): Promise<void> {
    const fileKey = getFileKey(view.file);

    if (view.file && this.shouldIgnoreFile(view.file)) {
      if (!automatic) {
        new Notice("NoteSpark is disabled inside the configured template folder.");
      }
      return;
    }

    if (this.processingFiles.has(fileKey)) {
      if (!automatic) {
        new Notice("NoteSpark is already generating for this note.");
      }
      return;
    }

    const originalContent = editor.getValue();
    const triggers = findNoteSparkTriggers(originalContent);

    if (triggers.length === 0) {
      if (!automatic) {
        new Notice("No NoteSpark triggers found in the active note.");
      }
      return;
    }

    this.processingFiles.add(fileKey);

    try {
      const replacements: TextReplacement[] = [];
      const prompts = triggers.map((trigger) => {
        const prompt = resolvePrompt(this.settings, trigger.presetId);

        if (!prompt) {
          throw new NoteSparkGenerationError(`No NoteSpark preset exists with ID ${trigger.presetId}.`);
        }

        return { trigger, prompt };
      });

      for (const { trigger, prompt } of prompts) {
        const generated = await generateQuote(this.settings, prompt, requestUrl);
        replacements.push({
          start: trigger.start,
          end: trigger.end,
          text: formatOutput(generated, this.settings, prompt),
        });
      }

      if (editor.getValue() !== originalContent) {
        throw new NoteSparkGenerationError("The note changed before NoteSpark could insert text.");
      }

      applyReplacements(editor, originalContent, replacements);

      if (!automatic) {
        new Notice(`Generated ${replacements.length} NoteSpark ${replacements.length === 1 ? "entry" : "entries"}.`);
      }
    } catch (error) {
      new Notice(getGenerationErrorMessage(error));
    } finally {
      this.processingFiles.delete(fileKey);
    }
  }

  private shouldIgnoreFile(file: TFile): boolean {
    return isFileInTemplateFolder(file.path, this.settings.templateFolderPath);
  }

  private openRegeneratePromptPicker(editor: Editor): void {
    const prompts = getPromptChoices(this.settings);
    new PromptPickerModal(this.app, prompts, async (prompt) => {
      await this.regenerateTarget(editor, prompt);
    }).open();
  }

  private async regenerateTarget(editor: Editor, prompt: ResolvedPrompt): Promise<void> {
    const originalContent = editor.getValue();
    const target = getRegenerationTarget(editor);

    if (!target) {
      new Notice("Select text or place the cursor inside an Obsidian callout to regenerate it.");
      return;
    }

    try {
      const generated = await generateQuote(this.settings, prompt, requestUrl);
      const output = formatOutput(generated, this.settings, prompt);

      if (editor.getValue() !== originalContent) {
        throw new NoteSparkGenerationError("The note changed before NoteSpark could insert text.");
      }

      editor.replaceRange(output, target.from, target.to);
      new Notice("Regenerated NoteSpark entry.");
    } catch (error) {
      new Notice(getGenerationErrorMessage(error));
    }
  }
}

function applyReplacements(
  editor: Editor,
  originalContent: string,
  replacements: TextReplacement[],
): void {
  for (const replacement of replacements.slice().sort((a, b) => b.start - a.start)) {
    editor.replaceRange(
      replacement.text,
      offsetToPosition(originalContent, replacement.start),
      offsetToPosition(originalContent, replacement.end),
    );
  }
}

function getRegenerationTarget(editor: Editor): ReplacementTarget | null {
  const selection = editor.getSelection();

  if (selection.trim()) {
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    return { from, to };
  }

  return getCurrentCalloutTarget(editor);
}

function getCurrentCalloutTarget(editor: Editor): ReplacementTarget | null {
  const cursor = editor.getCursor();
  const lineCount = editor.lineCount();
  const currentLine = editor.getLine(cursor.line);

  if (!isBlockquoteLine(currentLine)) {
    return null;
  }

  let startLine = cursor.line;
  while (startLine > 0 && isBlockquoteLine(editor.getLine(startLine - 1))) {
    startLine -= 1;
  }

  if (!/^\s*>\s*\[!/.test(editor.getLine(startLine))) {
    return null;
  }

  let endLine = cursor.line;
  while (endLine + 1 < lineCount && isBlockquoteLine(editor.getLine(endLine + 1))) {
    endLine += 1;
  }

  return {
    from: { line: startLine, ch: 0 },
    to: { line: endLine, ch: editor.getLine(endLine).length },
  };
}

function isBlockquoteLine(line: string): boolean {
  return /^\s*>\s?/.test(line);
}

function getFileKey(file: TFile | null): string {
  return file?.path ?? "__active_note__";
}

function getGenerationErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "NoteSpark generation failed.";
}
