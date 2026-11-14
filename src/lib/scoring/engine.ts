/**
 * Deterministic vendor scoring. No AI, no randomness: every number on the
 * comparison screen can be reproduced from the quotation and vendor records.
 */

export type CriterionKey = "price" | "delivery" | "quality" | "reliability" | "payment";

export type ScoringWeights = Record<CriterionKey, number>;

export const DEFAULT_WEIGHTS: ScoringWeights = {
  price: 35,
  delivery: 20,
  quality: 20,
  reliability: 15,
  payment: 10,
};

export const CRITERION_META: Record<CriterionKey, { label: string; short: string }> = {
  price: { label: "Price", short: "Total quoted cost" },
  delivery: { label: "Delivery", short: "Lead time in days" },
  quality: { label: "Quality & warranty", short: "Warranty + compliance" },
  reliability: { label: "Reliability", short: "Delivery reliability score" },
  payment: { label: "Payment terms", short: "Time allowed to pay" },
};

export type ScorableQuote = {
  quotationId: string;
  vendorId: string;
  vendorName: string;
  totalAmount: number | null;
  deliveryDays: number | null;
  paymentTerms: string | null;
  warrantyMonths: number | null;
  deliveryReliability: number | null;
  performanceRating: number | null;
  complianceStatus: "COMPLIANT" | "PENDING" | "NON_COMPLIANT";
};

export type CriterionResult = {
  key: CriterionKey;
  label: string;
  weight: number;
  score: number | null;
  weighted: number | null;
  missing: boolean;
  detail: string;
};

export type QuoteScore = {
  quotationId: string;
  vendorId: string;
  vendorName: string;
  totalAmount: number | null;
  deliveryDays: number | null;
  paymentTerms: string | null;
  warrantyMonths: number | null;
  criteria: CriterionResult[];
  overall: number | null;
  missing: CriterionKey[];
  missingLabels: string[];
  completeness: number;
  eligible: boolean;
  rank: number | null;
  costDelta: number | null;
  costPremiumPct: number | null;
  strengths: string[];
  weaknesses: string[];
};

export type ComparisonResult = {
  scores: QuoteScore[];
  weights: ScoringWeights;
  lowestCost: number | null;
  highestCost: number | null;
  leader: QuoteScore | null;
  excludedCriteria: CriterionKey[];
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function normalizeWeights(input: unknown): ScoringWeights {
  const raw = (input ?? {}) as Partial<Record<CriterionKey, unknown>>;
  const out = { ...DEFAULT_WEIGHTS };
  let sum = 0;
  (Object.keys(DEFAULT_WEIGHTS) as CriterionKey[]).forEach((key) => {
    const value = Number(raw[key]);
    if (Number.isFinite(value) && value >= 0 && value <= 100) out[key] = round1(value);
    sum += out[key];
  });
  if (Math.abs(sum - 100) > 0.01) {
    const factor = sum > 0 ? 100 / sum : 0;
    if (factor === 0) return { ...DEFAULT_WEIGHTS };
    (Object.keys(out) as CriterionKey[]).forEach((key) => {
      out[key] = round1(out[key] * factor);
    });
    // Correct display rounding drift on the largest weight.
    const total = Object.values(out).reduce((a, b) => a + b, 0);
    const largest = (Object.keys(out) as CriterionKey[]).sort((a, b) => out[b] - out[a])[0];
    out[largest] = round1(out[largest] + (100 - total));
  }
  return out;
}

export function weightsSum(weights: ScoringWeights) {
  return round1(Object.values(weights).reduce((a, b) => a + b, 0));
}

/** Net-30 is worth more than payment on delivery. Unknown terms are not assumed. */
export function scorePaymentTerms(terms: string | null): { score: number; detail: string } | null {
  if (!terms?.trim()) return null;
  const text = terms.toLowerCase();
  if (/(prepay|upfront|advance|deposit)/.test(text)) {
    return { score: 10, detail: `"${terms}" — payment before delivery` };
  }
  if (/(on delivery|upon delivery|on receipt|upon receipt|cod|cash)/.test(text)) {
    return { score: 35, detail: `"${terms}" — payment at delivery` };
  }
  const net = text.match(/net[-\s]?(\d{1,3})/);
  const days = net ? Number(net[1]) : text.match(/(\d{1,3})\s*(day|days)/)?.[1] ? Number(text.match(/(\d{1,3})\s*(day|days)/)![1]) : null;
  if (days !== null && Number.isFinite(days)) {
    const score = clamp(40 + days, 0, 100);
    return { score, detail: `${days} days to pay — score = min(100, 40 + ${days})` };
  }
  return null;
}

export function complianceScore(status: ScorableQuote["complianceStatus"]) {
  if (status === "COMPLIANT") return 100;
  if (status === "PENDING") return 55;
  return 0;
}

export function compareQuotations(quotes: ScorableQuote[], inputWeights: unknown): ComparisonResult {
  const weights = normalizeWeights(inputWeights);
  const totals = quotes.map((q) => q.totalAmount).filter((v): v is number => v !== null && Number.isFinite(v));
  const lowestCost = totals.length ? Math.min(...totals) : null;
  const highestCost = totals.length ? Math.max(...totals) : null;

  const leadTimes = quotes.map((q) => q.deliveryDays).filter((v): v is number => v !== null && v >= 0);
  const fastest = leadTimes.length ? Math.min(...leadTimes) : null;

  const results: QuoteScore[] = quotes.map((quote) => {
    const criteria: CriterionResult[] = [];
    const missing: CriterionKey[] = [];

    const push = (
      key: CriterionKey,
      detail: string,
      score: number | null,
      missingDetail?: string,
    ) => {
      const weight = weights[key];
      const isMissing = score === null;
      if (isMissing) missing.push(key);
      criteria.push({
        key,
        label: CRITERION_META[key].label,
        weight,
        score: isMissing ? null : round1(score),
        weighted: isMissing ? null : round1((score * weight) / 100),
        missing: isMissing,
        detail: isMissing ? (missingDetail ?? "Not stated in the quotation") : detail,
      });
    };

    // Price: best price scores 100, others scale inversely.
    if (quote.totalAmount === null || lowestCost === null) {
      push("price", "", null, "Total cost missing");
    } else {
      const score = lowestCost === 0 ? 100 : clamp((lowestCost / quote.totalAmount) * 100);
      push(
        "price",
        quote.totalAmount === lowestCost
          ? "Lowest total cost — 100"
          : `(lowest ${lowestCost.toFixed(2)} ÷ ${quote.totalAmount.toFixed(2)}) × 100`,
        score,
      );
    }

    // Delivery: fastest lead time scores 100.
    if (quote.deliveryDays === null || fastest === null) {
      push("delivery", "", null, "Delivery timeline missing");
    } else {
      const score = fastest === 0 ? (quote.deliveryDays === 0 ? 100 : 0) : clamp((fastest / quote.deliveryDays) * 100);
      push(
        "delivery",
        quote.deliveryDays === fastest
          ? `Fastest at ${quote.deliveryDays} days — 100`
          : `(${fastest} ÷ ${quote.deliveryDays}) × 100`,
        score,
      );
    }

    // Quality: 70% warranty coverage (24 months = full marks), 30% compliance.
    if (quote.warrantyMonths === null) {
      push("quality", "", null, "Warranty missing");
    } else {
      const warranty = clamp((quote.warrantyMonths / 24) * 100);
      const compliance = complianceScore(quote.complianceStatus);
      const score = clamp(warranty * 0.7 + compliance * 0.3);
      push(
        "quality",
        `70% × warranty (${quote.warrantyMonths} mo) + 30% × compliance (${quote.complianceStatus.toLowerCase()})`,
        score,
      );
    }

    // Reliability: vendor's recorded delivery reliability, falling back to rating.
    const reliability = quote.deliveryReliability ?? quote.performanceRating;
    if (reliability === null) {
      push("reliability", "", null, "Vendor reliability not recorded");
    } else {
      push(
        "reliability",
        `${quote.deliveryReliability !== null ? "Delivery reliability" : "Performance rating"}: ${reliability}/100`,
        clamp(reliability),
      );
    }

    const payment = scorePaymentTerms(quote.paymentTerms);
    if (!payment) {
      push("payment", "", null, "Payment terms missing or unrecognised");
    } else {
      push("payment", payment.detail, payment.score);
    }

    const available = criteria.filter((c) => c.score !== null);
    const availableWeight = available.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = available.reduce((sum, c) => sum + (c.weighted ?? 0), 0);
    const overall = availableWeight > 0 ? round1(weightedSum / (availableWeight / 100)) : null;
    const completeness = round1(criteria.reduce((sum, c) => (c.score !== null ? sum + c.weight : sum), 0));

    const strengths = criteria
      .filter((c) => c.score !== null && c.score >= 85 && c.weight > 0)
      .map((c) => `${c.label}: ${c.score}`);
    const weaknesses = criteria
      .filter((c) => c.score !== null && c.score < 55 && c.weight > 0)
      .map((c) => `${c.label}: ${c.score}`);
    if (missing.length) weaknesses.push(`Missing: ${missing.map((m) => CRITERION_META[m].label).join(", ")}`);

    return {
      quotationId: quote.quotationId,
      vendorId: quote.vendorId,
      vendorName: quote.vendorName,
      totalAmount: quote.totalAmount,
      deliveryDays: quote.deliveryDays,
      paymentTerms: quote.paymentTerms,
      warrantyMonths: quote.warrantyMonths,
      criteria,
      overall,
      missing,
      missingLabels: missing.map((m) => CRITERION_META[m].label),
      completeness,
      eligible: quote.totalAmount !== null,
      rank: null,
      costDelta:
        quote.totalAmount !== null && lowestCost !== null ? round1(quote.totalAmount - lowestCost) : null,
      costPremiumPct:
        quote.totalAmount !== null && lowestCost !== null && lowestCost > 0
          ? round1(((quote.totalAmount - lowestCost) / lowestCost) * 100)
          : null,
      strengths,
      weaknesses,
    };
  });

  const ranked = results
    .filter((r) => r.eligible && r.overall !== null)
    .sort((a, b) => (b.overall! - a.overall!) || ((a.totalAmount ?? 0) - (b.totalAmount ?? 0)));

  ranked.forEach((quote, index) => {
    const target = results.find((r) => r.quotationId === quote.quotationId);
    if (target) target.rank = index + 1;
  });

  return {
    scores: results,
    weights,
    lowestCost,
    highestCost,
    leader: ranked[0] ?? null,
    excludedCriteria: (Object.keys(weights) as CriterionKey[]).filter(
      (key) => weights[key] > 0 && results.length > 0 && results.every((r) => r.missing.includes(key)),
    ),
  };
}

export function explainWeights(weights: ScoringWeights) {
  return (Object.keys(weights) as CriterionKey[])
    .map((key) => `${CRITERION_META[key].label} ${weights[key]}%`)
    .join(" · ");
}
