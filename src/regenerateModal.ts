import { SuggestModal } from "obsidian";
import type { ResolvedPrompt } from "./types";

export class PromptPickerModal extends SuggestModal<ResolvedPrompt> {
  constructor(
    app: ConstructorParameters<typeof SuggestModal<ResolvedPrompt>>[0],
    private readonly prompts: ResolvedPrompt[],
    private readonly onChoosePrompt: (prompt: ResolvedPrompt) => void | Promise<void>,
  ) {
    super(app);
    this.setPlaceholder("Choose a NoteSpark prompt");
  }

  getSuggestions(query: string): ResolvedPrompt[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return this.prompts;
    }

    return this.prompts.filter((prompt) => {
      const id = prompt.id === undefined ? "default" : String(prompt.id);
      return (
        prompt.label.toLowerCase().includes(normalizedQuery) ||
        id.includes(normalizedQuery) ||
        prompt.prompt.toLowerCase().includes(normalizedQuery)
      );
    });
  }

  renderSuggestion(prompt: ResolvedPrompt, el: HTMLElement): void {
    el.createDiv({ text: prompt.label, cls: "notespark-suggestion-title" });
    el.createDiv({ text: prompt.prompt, cls: "notespark-suggestion-prompt" });
  }

  onChooseSuggestion(prompt: ResolvedPrompt): void {
    void this.onChoosePrompt(prompt);
  }
}

