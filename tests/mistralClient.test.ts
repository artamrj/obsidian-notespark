import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { generateQuote, type Requester } from "../src/mistralClient";
import { normalizeSettings, resolvePrompt } from "../src/settings";

function response(status: number, json: unknown): RequestUrlResponse {
  return {
    status,
    json,
  } as RequestUrlResponse;
}

describe("generateQuote", () => {
  it("calls Mistral chat completions and returns cleaned content", async () => {
    const settings = normalizeSettings({ apiKey: "secret" });
    const prompt = resolvePrompt(settings)!;
    const requester = vi.fn<Requester>(async () =>
      response(200, {
        choices: [
          {
            message: {
              content: "  Stay close to the next honest step.  ",
            },
          },
        ],
      }),
    );

    await expect(generateQuote(settings, prompt, requester)).resolves.toBe(
      "Stay close to the next honest step.",
    );

    const request = requester.mock.calls[0][0] as RequestUrlParam;
    expect(request.url).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(request.method).toBe("POST");
    expect(request.headers).toMatchObject({
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    });
  });

  it("does not call the API without a key", async () => {
    const settings = normalizeSettings({ apiKey: "" });
    const prompt = resolvePrompt(settings)!;
    const requester = vi.fn<Requester>();

    await expect(generateQuote(settings, prompt, requester)).rejects.toThrow(
      "Add a Mistral API key",
    );
    expect(requester).not.toHaveBeenCalled();
  });

  it("surfaces non-200 API errors", async () => {
    const settings = normalizeSettings({ apiKey: "secret" });
    const prompt = resolvePrompt(settings)!;
    const requester: Requester = async () =>
      response(401, {
        error: {
          message: "Unauthorized",
        },
      });

    await expect(generateQuote(settings, prompt, requester)).rejects.toThrow(
      "Mistral request failed: Unauthorized",
    );
  });

  it("rejects malformed successful responses", async () => {
    const settings = normalizeSettings({ apiKey: "secret" });
    const prompt = resolvePrompt(settings)!;
    const requester: Requester = async () => response(200, { choices: [] });

    await expect(generateQuote(settings, prompt, requester)).rejects.toThrow(
      "Mistral response did not include generated content",
    );
  });

  it("times out slow requests", async () => {
    vi.useFakeTimers();

    const settings = normalizeSettings({
      apiKey: "secret",
      requestTimeoutMs: 1000,
    });
    const prompt = resolvePrompt(settings)!;
    const requester: Requester = () => new Promise(() => undefined);
    const result = generateQuote(settings, prompt, requester);
    const assertion = expect(result).rejects.toThrow("Mistral request timed out after 1000 ms");

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    vi.useRealTimers();
  });
});
