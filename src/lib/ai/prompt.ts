export const EXTRACTION_KEYS = [
  "vendor_name",
  "product_description",
  "unit_price",
  "quantity",
  "subtotal",
  "tax_amount",
  "additional_charges",
  "total_amount",
  "currency",
  "delivery_days",
  "delivery_timeline",
  "payment_terms",
  "warranty_months",
  "validity_date",
  "items",
  "confidence",
  "notes",
] as const;

export function buildExtractionPrompt(text: string, fileName: string) {
  return `You are a procurement data-extraction engine. Read the vendor quotation below and return ONE JSON object.

Rules — accuracy matters more than completeness:
- Use ONLY information explicitly present in the document. If a value is not stated, return null. Never guess, infer typical values, or fill defaults.
- Do not invent line items. If the document has no itemised lines, return "items": [].
- Numbers must be plain JSON numbers without currency symbols or thousands separators.
- "warranty_months" must be a number of months (convert "2 years" to 24). If warranty is not stated, null.
- "delivery_days" must be a whole number of days if a concrete lead time is stated. If only a date is given and a lead time cannot be calculated safely, use null and put the wording in "delivery_timeline".
- "validity_date" must be ISO YYYY-MM-DD. If absent, null.
- "payment_terms" should be the document wording, e.g. "Net 30".
- "confidence" maps each extracted field name to your confidence from 0 to 1. Include only fields you extracted.
- Include taxes and additional charges separately when stated; do not fold them into the subtotal.
- "notes" is a short remark about ambiguity, or null.

Return exactly this shape:
{
  "vendor_name": string|null,
  "product_description": string|null,
  "unit_price": number|null,
  "quantity": number|null,
  "subtotal": number|null,
  "tax_amount": number|null,
  "additional_charges": number|null,
  "total_amount": number|null,
  "currency": string|null,
  "delivery_days": number|null,
  "delivery_timeline": string|null,
  "payment_terms": string|null,
  "warranty_months": number|null,
  "validity_date": string|null,
  "items": [{"description": string, "quantity": number|null, "unit_price": number|null, "total": number|null}],
  "confidence": {"field_name": number},
  "notes": string|null
}

File: ${fileName}

Quotation text:
"""
${text.slice(0, 24_000)}
"""`;
}

export function buildComparisonSummaryPrompt(payload: {
  requestTitle: string;
  currency: string;
  weights: Record<string, number>;
  vendors: {
    name: string;
    total: number | null;
    overallScore: number | null;
    rank: number | null;
    missing: string[];
    strengths: string[];
    weaknesses: string[];
  }[];
}) {
  return `You are assisting a procurement manager. Write a concise, neutral comparison summary (max 110 words) for this purchase request using ONLY the deterministic scores supplied.

Rules:
- Do not recommend awarding a contract. Do not invent facts or prices.
- Call out cost and lead-time differences, trade-offs, and missing information.
- Plain prose, no headings, no bullet points.

Purchase request: ${payload.requestTitle}
Weights: ${JSON.stringify(payload.weights)}
Currency: ${payload.currency}
Vendor scores (calculated by application code):
${JSON.stringify(payload.vendors, null, 2)}`;
}
