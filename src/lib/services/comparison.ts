import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { compareQuotations, normalizeWeights, type ScorableQuote, type ScoringWeights } from "@/lib/scoring/engine";
import { summarizeComparison } from "@/lib/ai/extract";
import { ExtractionError } from "@/lib/ai/schema";
import { weightsSchema } from "@/lib/validation/schemas";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "./audit";
import { ServiceError } from "./errors";
import { requestScope } from "./requests";

export async function loadComparison(user: SessionUser, requestId: string, overrideWeights?: unknown) {
  if (!can(user.role, "quotation:read")) {
    throw new ServiceError("You do not have permission to view comparisons.", "FORBIDDEN");
  }
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    include: {
      department: { select: { name: true } },
      recommendedVendor: { select: { id: true, name: true } },
      quotations: {
        include: {
          vendor: true,
          items: true,
          documents: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!request) return null;

  const organisation = await prisma.organisation.findUnique({
    where: { id: user.orgId },
    select: { defaultWeights: true, currency: true },
  });

  const stored = request.scoringWeights ?? organisation?.defaultWeights ?? undefined;
  const weights = normalizeWeights(overrideWeights ?? stored);
  const weightsSource = overrideWeights
    ? "custom"
    : request.scoringWeights
      ? "request"
      : "organisation";

  const scorable: ScorableQuote[] = request.quotations.map((quotation) => ({
    quotationId: quotation.id,
    vendorId: quotation.vendorId,
    vendorName: quotation.vendor.name,
    totalAmount: toNumber(quotation.totalAmount),
    deliveryDays: quotation.deliveryDays,
    paymentTerms: quotation.paymentTerms,
    warrantyMonths: quotation.warrantyMonths,
    deliveryReliability: quotation.vendor.deliveryReliability,
    performanceRating: quotation.vendor.performanceRating,
    complianceStatus: quotation.vendor.complianceStatus,
  }));

  const comparison = compareQuotations(scorable, weights);

  return {
    request,
    quotationRecords: request.quotations,
    comparison,
    weights: weights as ScoringWeights,
    weightsSource,
    currency: organisation?.currency ?? user.currency,
  };
}

export async function saveScoringWeights(user: SessionUser, requestId: string, raw: unknown) {
  if (!can(user.role, "quotation:select")) {
    throw new ServiceError("Only procurement managers and administrators can change scoring weights.", "FORBIDDEN");
  }
  const parsed = weightsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ServiceError(parsed.error.issues[0]?.message ?? "Invalid weights.", "INVALID");
  }
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, orgId: user.orgId },
    select: { id: true, reference: true, scoringWeights: true },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: requestId },
      data: { scoringWeights: parsed.data },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      action: "update_scoring_weights",
      before: request.scoringWeights ?? undefined,
      after: parsed.data,
    });
  });

  return parsed.data;
}

export async function generateComparisonSummary(user: SessionUser, requestId: string, overrideWeights?: unknown) {
  const data = await loadComparison(user, requestId, overrideWeights);
  if (!data) throw new ServiceError("Comparison not found.", "NOT_FOUND");
  if (!data.comparison.scores.length) {
    throw new ServiceError("Add quotations before asking for a summary.", "INVALID");
  }

  try {
    const result = await summarizeComparison({
      requestTitle: data.request.title,
      currency: data.currency,
      weights: data.weights,
      vendors: data.comparison.scores.map((score) => ({
        name: score.vendorName,
        total: score.totalAmount,
        overallScore: score.overall,
        rank: score.rank,
        missing: score.missingLabels,
        strengths: score.strengths,
        weaknesses: score.weaknesses,
      })),
    });
    return result;
  } catch (error) {
    if (error instanceof ExtractionError) throw new ServiceError(error.message, "INVALID");
    throw error;
  }
}
