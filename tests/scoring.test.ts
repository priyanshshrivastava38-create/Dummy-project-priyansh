import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareQuotations,
  normalizeWeights,
  scorePaymentTerms,
  type ScorableQuote,
} from "../src/lib/scoring/engine";

const close = (actual: number | null, expected: number, tolerance = 0.05) => {
  assert.notEqual(actual, null);
  assert.ok(
    Math.abs((actual as number) - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

const baseQuote = (overrides: Partial<ScorableQuote>): ScorableQuote => ({
  quotationId: "q",
  vendorId: "v",
  vendorName: "Vendor",
  totalAmount: 10_000,
  deliveryDays: 14,
  paymentTerms: "Net 30",
  warrantyMonths: 24,
  deliveryReliability: 85,
  performanceRating: 80,
  complianceStatus: "COMPLIANT",
  ...overrides,
});

test("default weights produce deterministic, explainable scores", () => {
  const atlas = baseQuote({
    quotationId: "atlas",
    vendorId: "v-atlas",
    vendorName: "Atlas Office",
    totalAmount: 10_000,
    deliveryDays: 10,
    warrantyMonths: 24,
    complianceStatus: "COMPLIANT",
    deliveryReliability: 90,
    paymentTerms: "Net 30",
  });
  const brio = baseQuote({
    quotationId: "brio",
    vendorId: "v-brio",
    vendorName: "Brio Supplies",
    totalAmount: 9_000,
    deliveryDays: 20,
    warrantyMonths: 12,
    complianceStatus: "PENDING",
    deliveryReliability: 70,
    paymentTerms: "Net 60",
  });

  const result = compareQuotations([atlas, brio], undefined);

  // Price 35 + delivery 20 + quality 20 + reliability 15 + payment 10.
  close(result.scores[0].overall, 92); // 90*0.35 + 100*0.2 + 100*0.2 + 90*0.15 + 70*0.1
  close(result.scores[1].overall, 75.8); // 100*0.35 + 50*0.2 + 51.5*0.2 + 70*0.15 + 100*0.1

  assert.equal(result.leader?.quotationId, "atlas");
  assert.equal(result.scores[0].rank, 1);
  assert.equal(result.scores[0].completeness, 100);
  assert.equal(result.lowestCost, 9_000);
  assert.equal(result.highestCost, 10_000);
  close(result.scores[0].costDelta, 1_000);
  close(result.scores[0].costPremiumPct, 11.1);
  assert.equal(result.scores[1].costDelta, 0);
  assert.deepEqual(result.excludedCriteria, []);
});

test("missing criteria are excluded and the remaining weights are renormalised", () => {
  const quote = baseQuote({
    quotationId: "sparse",
    totalAmount: 5_000,
    deliveryDays: null,
    paymentTerms: null,
    warrantyMonths: 24,
    complianceStatus: "COMPLIANT",
    deliveryReliability: 80,
  });

  const result = compareQuotations([quote], undefined);
  const score = result.scores[0];

  // Available weight: price 35 + quality 20 + reliability 15 = 70.
  // Raw weighted points: 35 + 20 + 12 = 67 -> 67 / 0.70 = 95.7.
  close(score.overall, 95.7);
  assert.equal(score.completeness, 70);
  assert.deepEqual(score.missing, ["delivery", "payment"]);
  assert.deepEqual(result.excludedCriteria, ["delivery", "payment"]);
  assert.ok(score.weaknesses.some((w) => w.startsWith("Missing:")));
});

test("price and delivery never assume unknown values", () => {
  const result = compareQuotations(
    [baseQuote({ quotationId: "no-total", totalAmount: null }), baseQuote({ quotationId: "fine" })],
    undefined,
  );
  const missing = result.scores.find((s) => s.quotationId === "no-total");
  assert.equal(missing?.eligible, false);
  assert.equal(missing?.rank, null);
  assert.ok(missing?.missing.includes("price"));
  // A quote without a total still exists in the scoring table but cannot lead.
  assert.notEqual(result.leader?.quotationId, "no-total");
});

test("payment terms score on stated terms only", () => {
  assert.equal(scorePaymentTerms("Net 30")?.score, 70);
  assert.equal(scorePaymentTerms("NET 45")?.score, 85);
  assert.equal(scorePaymentTerms("Due on delivery")?.score, 35);
  assert.equal(scorePaymentTerms("50% upfront, balance on delivery")?.score, 10);
  assert.equal(scorePaymentTerms("As agreed")?.score, undefined);
  assert.equal(scorePaymentTerms("   "), null);
  assert.equal(scorePaymentTerms(null), null);
});

test("unknown payment terms score null rather than a guessed value", () => {
  const result = compareQuotations([baseQuote({ paymentTerms: "To be discussed" })], undefined);
  const payment = result.scores[0].criteria.find((c) => c.key === "payment");
  assert.equal(payment?.score, null);
  assert.equal(payment?.weighted, null);
  assert.equal(result.scores[0].missing.includes("payment"), true);
});

test("normalizeWeights renormalises and repairs invalid inputs", () => {
  const equal = normalizeWeights({ price: 1, delivery: 1, quality: 1, reliability: 1, payment: 1 });
  assert.deepEqual(equal, { price: 20, delivery: 20, quality: 20, reliability: 20, payment: 20 });

  const broken = normalizeWeights({ price: "oops", delivery: -4, quality: 200, reliability: 15, payment: 10 });
  assert.equal(Object.values(broken).reduce((a, b) => a + b, 0), 100);
  assert.ok(broken.price > 0 && broken.delivery >= 0 && broken.quality <= 100);
});

test("custom weights change the ranking as expected", () => {
  const cheap = baseQuote({
    quotationId: "cheap",
    totalAmount: 8_000,
    deliveryDays: 40,
    warrantyMonths: 6,
    complianceStatus: "PENDING",
    deliveryReliability: 50,
    paymentTerms: "Upfront",
  });
  const premium = baseQuote({
    quotationId: "premium",
    totalAmount: 12_000,
    deliveryDays: 7,
    warrantyMonths: 36,
    complianceStatus: "COMPLIANT",
    deliveryReliability: 95,
    paymentTerms: "Net 60",
  });

  const priceLed = compareQuotations([cheap, premium], { price: 80, delivery: 5, quality: 5, reliability: 5, payment: 5 });
  const serviceLed = compareQuotations([cheap, premium], { price: 5, delivery: 30, quality: 30, reliability: 25, payment: 10 });

  assert.equal(priceLed.leader?.quotationId, "cheap");
  assert.equal(serviceLed.leader?.quotationId, "premium");
});
