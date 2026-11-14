import { getAiProvider } from "./provider";
import { buildComparisonSummaryPrompt, buildExtractionPrompt } from "./prompt";
import {
  ExtractionError,
  normalizeExtraction,
  parseJsonResponse,
  type NormalizedExtraction,
} from "./schema";

export type ExtractionOutcome = {
  extraction: NormalizedExtraction;
  provider: { id: string; label: string; model: string };
};

export async function extractQuotationData(text: string, fileName: string): Promise<ExtractionOutcome> {
  const provider = getAiProvider();
  if (!provider) {
    throw new ExtractionError(
      "AI extraction is not configured. Use the manual quotation editor instead.",
      "provider",
    );
  }

  const basePrompt = buildExtractionPrompt(text, fileName);
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const prompt =
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\nYour previous answer was not valid. Return ONLY a single valid JSON object with exactly the requested keys. Use null for anything not stated in the document.`;
      const response = await provider.complete(prompt, { json: true });
      const raw = parseJsonResponse(response);
      const extraction = normalizeExtraction(raw);
      return {
        extraction,
        provider: { id: provider.id, label: provider.label, model: provider.model },
      };
    } catch (error) {
      lastError = error;
      if (error instanceof ExtractionError && error.stage === "provider") break;
    }
  }

  if (lastError instanceof ExtractionError) throw lastError;
  throw new ExtractionError("Extraction failed. No values were imported; enter them manually.", "provider");
}

export async function summarizeComparison(payload: Parameters<typeof buildComparisonSummaryPrompt>[0]) {
  const provider = getAiProvider();
  if (!provider) {
    throw new ExtractionError(
      "AI summaries need a configured provider. All scores below are calculated without AI.",
      "provider",
    );
  }
  const prompt = buildComparisonSummaryPrompt(payload);
  try {
    return {
      summary: (await provider.complete(prompt, { json: false })).trim(),
      provider: { id: provider.id, label: provider.label, model: provider.model },
    };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError("The AI summary could not be generated. Scores are unaffected.", "provider");
  }
}
