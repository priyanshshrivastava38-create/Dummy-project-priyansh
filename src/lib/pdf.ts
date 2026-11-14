import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extracts selectable text from a PDF. Scanned/image-only PDFs return
 * near-empty text; callers must surface that instead of guessing values.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  return text.replace(/\u0000/g, "").trim();
}
