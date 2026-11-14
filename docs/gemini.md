# AI setup: Gemini and Ollama

AI is optional in OpsLedger. It powers exactly two features:

1. **Quotation extraction** — reading a vendor PDF into editable fields.
2. **Comparison summary** — a short plain-language description of scores the app has already calculated.

Scoring, ranking, approvals and award selection never call a model.

## Option A — Google Gemini (primary)

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Add it to `.env`:

   ```bash
   GEMINI_API_KEY="your-key"
   GEMINI_MODEL="gemini-2.5-flash"   # optional; this is the default
   ```

3. Restart the dev server. The quotation dialog switches from "manual only" to offering AI extraction.

### How the request is made

`src/lib/ai/provider.ts` calls the REST endpoint directly from the server:

```
POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
x-goog-api-key: <GEMINI_API_KEY>
```

- `temperature: 0` for repeatability
- `responseMimeType: application/json` for extraction
- 90-second timeout
- The key is read with `process.env` inside a module that is only imported by Server Actions and route handlers. It is never sent to the browser and there is no `NEXT_PUBLIC_` variant.

Consequences of a bad key, quota exhaustion or an outage: the action returns a readable error, nothing is written to the quotation, and manual entry stays available. Provider failures are not retried automatically.

### Extraction contract

- Text is extracted from the PDF with `unpdf` (first 24,000 characters) and sent with a strict instruction set: use only stated values, return `null` for anything absent, never invent line items.
- The model must return a fixed JSON shape (vendor, amounts, tax, delivery, payment terms, warranty, validity, items, per-field confidence, notes).
- The response is parsed and normalised with Zod: currency symbols are stripped, dates coerced to `YYYY-MM-DD`, percentages converted to 0–1 confidence, "2 years" converted to 24 months, and oversized or non-finite numbers rejected.
- If the first answer is not valid JSON or fails the schema, one corrective retry is made. A second failure returns an error rather than partial data.
- The UI shows every field for review, highlights missing fields and low confidence, and requires the user to save. The original upload is preserved.
- Scanned/image-only PDFs produce little text; the app reports that instead of guessing. There is no OCR in this build.

## Option B — local Ollama

Useful for offline development or when you do not want an external API call.

```bash
ollama pull qwen2.5:3b
ollama serve
```

```bash
# .env — leave GEMINI_API_KEY empty
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen2.5:3b"
```

The provider posts to `${OLLAMA_BASE_URL}/api/chat` with `stream: false`, `format: "json"` for extraction, `temperature: 0`, and a 120-second timeout.

Notes:

- **Gemini wins if both are configured.** The selection order is `GEMINI_API_KEY` → `OLLAMA_BASE_URL` → no AI.
- Small local models produce more schema errors than hosted models. The corrective retry helps, but keep the manual editor as the source of truth for anything questionable.
- A dead Ollama server shows up as a provider error. Check that port 11434 is listening before assuming the app is broken.

## Comparison summary

Only when you press the summary button, the app sends the computed weights, per-vendor totals, scores, ranks, strengths, weaknesses and missing criteria to the model. The prompt caps the response at 110 words, forbids inventing facts, and explicitly forbids recommending an award. The summary is display-only and cannot change scores or selection.

## Verifying AI locally

1. Sign in as `procurement@opsledger.app`.
2. Open an approved request and add a quotation by PDF (or use one of the seeded quotation documents as a reference).
3. Run extraction and confirm fields arrive in the editable dialog with a confidence indicator.
4. Turn the key off and confirm the app reports that AI is unavailable and still allows manual entry.

If extraction fails with `Gemini request failed (400)`, the key is usually invalid or the model name is unavailable to your account. `(429)` means quota; wait or switch models. `(404)` usually means the model id does not exist for that API version.
