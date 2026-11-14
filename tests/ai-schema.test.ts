import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ExtractionError,
  normalizeDate,
  normalizeExtraction,
  parseJsonResponse,
} from "../src/lib/ai/schema";

test("normalizeExtraction coerces messy model output into safe values", () => {
  const normalized = normalizeExtraction({
    vendor_name: "  Meridian Office Systems  ",
    product_description: "Ergonomic task chairs",
    unit_price: "$1,250.50",
    quantity: "12 units",
    tax_amount: "120",
    additional_charges: null,
    total_amount: "$15,120",
    currency: "usd",
    delivery_days: "14",
    delivery_timeline: "2 weeks",
    payment_terms: "Net 30",
    warranty_months: "2 years",
    validity_date: "31/12/2026",
    items: [{ description: "Task chair", quantity: "5", unit_price: "$250.50", total: "$1,252.50" }],
    confidence: { vendor_name: 92, unit_price: 0.8, total_amount: 110 },
    notes: "Freight included",
  });

  assert.equal(normalized.vendorName, "Meridian Office Systems");
  assert.equal(normalized.unitPrice, 1_250.5);
  assert.equal(normalized.quantity, 12);
  assert.equal(normalized.totalAmount, 15_120);
  assert.equal(normalized.currency, "USD");
  assert.equal(normalized.warrantyMonths, 24);
  assert.equal(normalized.validityDate, "2026-12-31");
  assert.equal(normalized.items[0].unitPrice, 250.5);
  assert.equal(normalized.confidence.vendor_name, 0.92);
  assert.equal(normalized.confidence.total_amount, 1);
  assert.equal(normalized.overallConfidence, 91);
  assert.ok(normalized.missingFields.includes("Additional charges"));
});

test("normalizeExtraction derives subtotal and total only from stated arithmetic", () => {
  const normalized = normalizeExtraction({
    items: [
      { description: "Monitor", quantity: 2, unit_price: 500 },
      { description: "Dock", quantity: 1, unit_price: 250 },
    ],
    tax_amount: 125,
  });

  assert.equal(normalized.subtotal, 1_250);
  assert.equal(normalized.totalAmount, 1_375);
  assert.equal(normalized.warnings.length, 2);
  assert.ok(normalized.warnings.some((w) => /Subtotal was calculated/.test(w)));
  assert.ok(normalized.warnings.some((w) => /Total was calculated/.test(w)));
  assert.ok(normalized.missingFields.includes("Vendor name"));
});

test("normalizeExtraction flags inconsistent totals instead of silently trusting them", () => {
  const normalized = normalizeExtraction({
    vendor_name: "Acme",
    subtotal: 1_000,
    tax_amount: 100,
    total_amount: 1_500,
  });
  assert.equal(normalized.totalAmount, 1_500);
  assert.ok(normalized.warnings.some((w) => /does not match subtotal/.test(w)));
});

test("negative and absurd amounts are rejected rather than imported", () => {
  const normalized = normalizeExtraction({
    vendor_name: "Acme",
    unit_price: "-50",
    quantity: 2,
    total_amount: 1_000_000_000_001,
  });
  assert.equal(normalized.unitPrice, null);
  assert.equal(normalized.totalAmount, null);
  assert.ok(normalized.missingFields.includes("Unit price"));
});

test("non-object payloads fail with a schema-stage error", () => {
  assert.throws(
    () => normalizeExtraction(null),
    (error: unknown) => error instanceof ExtractionError && error.stage === "schema",
  );
});

test("normalizeDate accepts ISO, day-first and parseable dates", () => {
  assert.equal(normalizeDate("2026-01-31"), "2026-01-31");
  assert.equal(normalizeDate("31/01/2026"), "2026-01-31");
  assert.equal(normalizeDate("5-6-2026"), "2026-06-05");
  assert.equal(normalizeDate("January 31, 2026"), "2026-01-31");
  assert.equal(normalizeDate("not a date"), null);
  assert.equal(normalizeDate(null), null);
});

test("parseJsonResponse tolerates fenced blocks and surrounding prose", () => {
  const parsed = parseJsonResponse('Here is the data:\n```json\n{"vendor_name":"Acme","total_amount":100}\n```\nDone.');
  assert.deepEqual(parsed, { vendor_name: "Acme", total_amount: 100 });
});

test("parseJsonResponse rejects non-JSON with a parse-stage error", () => {
  assert.throws(
    () => parseJsonResponse("I could not read the document."),
    (error: unknown) => error instanceof ExtractionError && error.stage === "parse",
  );
  assert.throws(
    () => parseJsonResponse("{ vendor_name: oops }"),
    (error: unknown) => error instanceof ExtractionError && error.stage === "parse",
  );
});
