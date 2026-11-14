import { ExtractionError } from "./schema";

export type AiProvider = {
  id: "gemini" | "ollama";
  label: string;
  model: string;
  complete(prompt: string, options?: { json?: boolean }): Promise<string>;
};

export type AiStatus =
  | { available: true; id: AiProvider["id"]; label: string; model: string }
  | { available: false; reason: string };

function geminiProvider(apiKey: string): AiProvider {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  return {
    id: "gemini",
    label: "Google Gemini",
    model,
    async complete(prompt, options) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              ...(options?.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
          signal: AbortSignal.timeout(90_000),
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ExtractionError(
          `Gemini request failed (${response.status}). ${body.slice(0, 180)}`,
          "provider",
        );
      }
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) throw new ExtractionError("Gemini returned an empty response.", "provider");
      return text;
    },
  };
}

function ollamaProvider(baseUrl: string): AiProvider {
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:3b";
  const root = baseUrl.replace(/\/+$/, "");
  return {
    id: "ollama",
    label: "Local Ollama",
    model,
    async complete(prompt, options) {
      const response = await fetch(`${root}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          ...(options?.json ? { format: "json" } : {}),
          options: { temperature: 0 },
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ExtractionError(
          `Ollama request failed (${response.status}). ${body.slice(0, 180)}`,
          "provider",
        );
      }
      const data = (await response.json()) as { message?: { content?: string } };
      const text = data.message?.content ?? "";
      if (!text.trim()) throw new ExtractionError("Ollama returned an empty response.", "provider");
      return text;
    },
  };
}

export function getAiProvider(): AiProvider | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) return geminiProvider(geminiKey);
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim();
  if (ollamaUrl) return ollamaProvider(ollamaUrl);
  return null;
}

export function getAiStatus(): AiStatus {
  const provider = getAiProvider();
  if (provider) {
    return { available: true, id: provider.id, label: provider.label, model: provider.model };
  }
  return {
    available: false,
    reason:
      "AI extraction is not configured. Add GEMINI_API_KEY (or OLLAMA_BASE_URL for local development) to enable it. Manual quotation entry remains fully available.",
  };
}
