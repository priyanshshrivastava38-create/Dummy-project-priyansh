import { z } from "zod";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public stage: "provider" | "parse" | "schema" | "document",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

const MAX_AMOUNT = 1_000_000_000_000;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value <= MAX_AMOUNT ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT ? n : null;
  }
  return null;
}

function parseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 2000) : null;
}

function parseCount(value: unknown): number | null {
  const n = parseNumber(value);
  if (n === null) return null;
  const int = Math.round(n);
  return int > 0 && int <= 1_000_000 ? int : null;
}

function parseMonths(value: unknown): number | null {
  if (typeof value === "string" && /year/i.test(value)) {
    const years = parseNumber(value);
    return years === null ? null : Math.round(years * 12);
  }
  const n = parseNumber(value);
  if (n === null) return null;
  const months = Math.round(n);
  return months >= 0 && months <= 600 ? months : null;
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${month}-${day}`;
  }
  // Keep the calendar date the model wrote; converting through UTC would
  // shift "January 31, 2026" back a day in positive timezones.
  const isoDateTime = s.match(/^(\d{4}-\d{2}-\d{2})[T ]/);
  if (isoDateTime) return isoDateTime[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return null;
}

const nullableNumber = z.any().transform(parseNumber);
const nullableText = z.any().transform(parseText);
const nullableDate = z.any().transform(normalizeDate);

const itemSchema = z.any().transform((value) => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 40)
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        description: parseText(row.description),
        quantity: parseCount(row.quantity),
        unitPrice: parseNumber(row.unit_price ?? row.unitPrice),
        total: parseNumber(row.total ?? row.line_total),
      };
    })
    .filter((item) => item.description !== null);
});

const confidenceSchema = z.any().transform((value): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    let n = parseNumber(raw);
    if (n === null) continue;
    if (n > 1) n = n / 100;
    out[key] = Math.min(1, Math.max(0, Math.round(n * 100) / 100));
  }
  return out;
});

export const rawExtractionSchema = z.object({
  vendor_name: nullableText,
  product_description: nullableText,
  unit_price: nullableNumber,
  quantity: nullableNumber,
  subtotal: nullableNumber,
  tax_amount: nullableNumber,
  additional_charges: nullableNumber,
  total_amount: nullableNumber,
  currency: z.any().transform((v) => {
    const s = parseText(v);
    return s && /^[A-Za-z]{3}$/.test(s) ? s.toUpperCase() : null;
  }),
  delivery_days: nullableNumber,
  delivery_timeline: nullableText,
  payment_terms: nullableText,
  warranty_months: z.any().transform(parseMonths),
  validity_date: nullableDate,
  items: itemSchema,
  confidence: confidenceSchema,
  notes: nullableText,
});

export type NormalizedExtraction = {
  vendorName: string | null;
  productDescription: string | null;
  unitPrice: number | null;
  quantity: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  additionalCharges: number | null;
  totalAmount: number | null;
  currency: string | null;
  deliveryDays: number | null;
  deliveryTimeline: string | null;
  paymentTerms: string | null;
  warrantyMonths: number | null;
  validityDate: string | null;
  items: { description: string | null; quantity: number | null; unitPrice: number | null; total: number | null }[];
  confidence: Record<string, number>;
  notes: string | null;
  missingFields: string[];
  warnings: string[];
  overallConfidence: number | null;
};

const FIELD_LABELS: Record<string, string> = {
  vendorName: "Vendor name",
  productDescription: "Product / service description",
  unitPrice: "Unit price",
  quantity: "Quantity",
  totalAmount: "Total amount",
  taxAmount: "Taxes",
  deliveryDays: "Delivery timeline",
  paymentTerms: "Payment terms",
  warrantyMonths: "Warranty",
  validityDate: "Validity period",
  additionalCharges: "Additional charges",
  items: "Line items",
};

const CONFIDENCE_KEYS: Record<string, string> = {
  vendorName: "vendor_name",
  productDescription: "product_description",
  unitPrice: "unit_price",
  quantity: "quantity",
  totalAmount: "total_amount",
  taxAmount: "tax_amount",
  deliveryDays: "delivery_days",
  paymentTerms: "payment_terms",
  warrantyMonths: "warranty_months",
  validityDate: "validity_date",
  additionalCharges: "additional_charges",
};

export function normalizeExtraction(raw: unknown): NormalizedExtraction {
  const parsed = rawExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ExtractionError(
      `The AI response did not match the required quotation schema: ${parsed.error.issues[0]?.message ?? "invalid structure"}`,
      "schema",
    );
  }
  const data = parsed.data;

  // Derive only arithmetic values explicitly supported by other extracted values.
  const itemSubtotal = data.items.length
    ? Math.round(
        data.items.reduce((sum, item) => {
          const line = item.total ?? (item.quantity !== null && item.unitPrice !== null ? item.quantity * item.unitPrice : 0);
          return sum + line;
        }, 0) * 100,
      ) / 100
    : null;

  let subtotal = data.subtotal;
  let total = data.total_amount;
  const warnings: string[] = [];

  if (subtotal === null && itemSubtotal !== null) {
    subtotal = itemSubtotal;
    warnings.push("Subtotal was calculated from the line items because the document did not state it.");
  }
  if (total === null && subtotal !== null) {
    total = Math.round((subtotal + (data.tax_amount ?? 0) + (data.additional_charges ?? 0)) * 100) / 100;
    warnings.push("Total was calculated from subtotal, taxes and additional charges.");
  }
  if (
    total !== null &&
    subtotal !== null &&
    Math.abs(total - (subtotal + (data.tax_amount ?? 0) + (data.additional_charges ?? 0))) > Math.max(1, total * 0.01)
  ) {
    warnings.push(
      `Document total (${total.toFixed(2)}) does not match subtotal + taxes + charges (${(subtotal + (data.tax_amount ?? 0) + (data.additional_charges ?? 0)).toFixed(2)}). Review before relying on it.`,
    );
  }
  if (data.items.length === 0 && (data.unit_price === null || data.quantity === null)) {
    warnings.push("No line items were found. Add them manually if the quotation itemises costs.");
  }

  const unitPrice = data.unit_price ?? (data.items.length === 1 ? data.items[0].unitPrice : null);
  const quantity = data.quantity ?? (data.items.length === 1 ? data.items[0].quantity : null);

  const candidateFields: Record<keyof typeof FIELD_LABELS, unknown> = {
    vendorName: data.vendor_name,
    productDescription: data.product_description,
    unitPrice,
    quantity,
    totalAmount: total,
    taxAmount: data.tax_amount,
    deliveryDays: data.delivery_days,
    paymentTerms: data.payment_terms,
    warrantyMonths: data.warranty_months,
    validityDate: data.validity_date,
    additionalCharges: data.additional_charges,
    items: data.items.length ? data.items : null,
  };

  const missingFields = Object.entries(candidateFields)
    .filter(([, value]) => value === null)
    .map(([key]) => FIELD_LABELS[key]);

  const confidences = Object.entries(CONFIDENCE_KEYS)
    .map(([, key]) => data.confidence[key])
    .filter((n): n is number => typeof n === "number");
  const overallConfidence = confidences.length
    ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100)
    : null;

  return {
    vendorName: data.vendor_name,
    productDescription: data.product_description,
    unitPrice,
    quantity,
    subtotal,
    taxAmount: data.tax_amount,
    additionalCharges: data.additional_charges,
    totalAmount: total,
    currency: data.currency,
    deliveryDays: data.delivery_days,
    deliveryTimeline: data.delivery_timeline,
    paymentTerms: data.payment_terms,
    warrantyMonths: data.warranty_months,
    validityDate: data.validity_date,
    items: data.items,
    confidence: data.confidence,
    notes: data.notes,
    missingFields,
    warnings,
    overallConfidence,
  };
}

/** Parse JSON returned by an LLM, tolerating fenced code blocks. */
export function parseJsonResponse(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new ExtractionError("The AI did not return JSON. No values were imported.", "parse");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new ExtractionError("The AI returned malformed JSON. No values were imported.", "parse");
  }
}
