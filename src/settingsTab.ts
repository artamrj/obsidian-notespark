import { PluginSettingTab, Setting } from "obsidian";
import { normalizeCalloutType } from "./settings";
import type NoteSparkPlugin from "./main";
import type { PromptPreset } from "./types";

export class NoteSparkSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: NoteSparkPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("notespark-settings");

    containerEl.createEl("h2", { text: "NoteSpark" });

    new Setting(containerEl)
      .setName("Mistral API key")
      .setDesc("Stored locally in this vault's plugin data.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("Mistral API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Model")
      .addText((text) =>
        text.setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value.trim() || "mistral-small-latest";
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Temperature")
      .setDesc("Higher values produce more varied output.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 0.1)
          .setValue(this.plugin.settings.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.temperature = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max output tokens")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxTokens)).onChange(async (value) => {
          this.plugin.settings.maxTokens = parseInteger(value, this.plugin.settings.maxTokens);
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Request timeout")
      .setDesc("Milliseconds before a Mistral request is treated as failed.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.requestTimeoutMs)).onChange(async (value) => {
          this.plugin.settings.requestTimeoutMs = parseInteger(
            value,
            this.plugin.settings.requestTimeoutMs,
          );
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl("h3", { text: "Default prompt" });

    new Setting(containerEl)
      .setName("Prompt")
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text
          .setValue(this.plugin.settings.defaultPrompt)
          .onChange(async (value) => {
            this.plugin.settings.defaultPrompt = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Maximum quote length")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.defaultMaxLength)).onChange(async (value) => {
          this.plugin.settings.defaultMaxLength = parseInteger(
            value,
            this.plugin.settings.defaultMaxLength,
          );
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl("h3", { text: "Output" });

    new Setting(containerEl)
      .setName("Output mode")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("callout", "Obsidian callout")
          .addOption("plain", "Plain text")
          .setValue(this.plugin.settings.outputMode)
          .onChange(async (value) => {
            this.plugin.settings.outputMode = value === "plain" ? "plain" : "callout";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default callout type")
      .addText((text) =>
        text.setValue(this.plugin.settings.defaultCalloutType).onChange(async (value) => {
          this.plugin.settings.defaultCalloutType = normalizeCalloutType(value);
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Auto-generate in active markdown files")
      .setDesc("Replaces standalone @notespark triggers after templates or manual typing add them.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoGenerate).onChange(async (value) => {
          this.plugin.settings.autoGenerate = value;
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl("h3", { text: "Prompt presets" });

    const presetContainer = containerEl.createDiv({ cls: "notespark-presets" });
    for (const preset of this.plugin.settings.presets) {
      this.renderPreset(presetContainer, preset);
    }

    new Setting(containerEl).addButton((button) =>
      button
        .setButtonText("Add preset")
        .setCta()
        .onClick(async () => {
          this.plugin.settings.presets.push({
            id: getNextPresetId(this.plugin.settings.presets),
            prompt: "Generate a concise reflection.",
            maxLength: 140,
            calloutType: "quote",
          });
          await this.plugin.saveSettings();
          this.display();
        }),
    );
  }

  private renderPreset(containerEl: HTMLElement, preset: PromptPreset): void {
    const presetEl = containerEl.createDiv({ cls: "notespark-preset" });
    const header = presetEl.createDiv({ cls: "notespark-preset-header" });
    header.createEl("strong", { text: `Preset ${preset.id}` });
    const deleteButton = header.createEl("button", { text: "Remove" });
    deleteButton.addEventListener("click", async () => {
      this.plugin.settings.presets = this.plugin.settings.presets.filter(
        (item) => item !== preset,
      );
      await this.plugin.saveSettings();
      this.display();
    });

    new Setting(presetEl)
      .setName("ID")
      .addText((text) =>
        text.setValue(String(preset.id)).onChange(async (value) => {
          preset.id = parseInteger(value, preset.id);
          await this.plugin.saveSettings();
        }),
      );

    new Setting(presetEl)
      .setName("Prompt")
      .addTextArea((text) => {
        text.inputEl.rows = 3;
        text.setValue(preset.prompt).onChange(async (value) => {
          preset.prompt = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(presetEl)
      .setName("Maximum quote length")
      .addText((text) =>
        text.setValue(String(preset.maxLength)).onChange(async (value) => {
          preset.maxLength = parseInteger(value, preset.maxLength);
          await this.plugin.saveSettings();
        }),
      );

    new Setting(presetEl)
      .setName("Callout type")
      .setDesc("Leave empty to use the global default.")
      .addText((text) =>
        text.setValue(preset.calloutType ?? "").onChange(async (value) => {
          preset.calloutType = value.trim() ? normalizeCalloutType(value) : undefined;
          await this.plugin.saveSettings();
        }),
      );
  }
}

function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getNextPresetId(presets: PromptPreset[]): number {
  return presets.reduce((highest, preset) => Math.max(highest, preset.id), 0) + 1;
}

