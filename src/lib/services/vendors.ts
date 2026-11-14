import { Prisma, type VendorStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { vendorSchema } from "@/lib/validation/schemas";
import { toNumber } from "@/lib/utils";
import { recordActivity, recordAudit } from "./audit";
import { ServiceError } from "./errors";

export type VendorInput = z.infer<typeof vendorSchema>;

export type VendorListFilters = {
  q?: string;
  category?: string;
  status?: string;
  compliance?: string;
  sort?: string;
  page?: number;
};

export async function listVendors(user: SessionUser, filters: VendorListFilters = {}) {
  if (!can(user.role, "vendor:read")) {
    throw new ServiceError("You do not have permission to view vendors.", "FORBIDDEN");
  }

  const where: Prisma.VendorWhereInput = {
    orgId: user.orgId,
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { contactName: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
            { category: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.category && filters.category !== "ALL" ? { category: filters.category } : {}),
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status as VendorStatus } : {}),
    ...(filters.compliance && filters.compliance !== "ALL"
      ? { complianceStatus: filters.compliance as "COMPLIANT" }
      : {}),
  };

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      quotations: {
        select: { status: true, totalAmount: true, requestId: true },
      },
      contracts: {
        select: { id: true, status: true, endDate: true, value: true },
      },
      _count: { select: { evaluations: true } },
    },
  });

  const rows = vendors.map((vendor) => {
    const selected = vendor.quotations.filter((q) => q.status === "SELECTED");
    const awarded = selected.reduce((sum, q) => sum + (toNumber(q.totalAmount) ?? 0), 0);
    return {
      ...vendor,
      quotationCount: vendor.quotations.length,
      awardedValue: awarded,
      contractCount: vendor.contracts.filter((c) => c.status === "ACTIVE" || c.status === "EXPIRING").length,
      activeRequests: new Set(vendor.quotations.map((q) => q.requestId)).size,
    };
  });

  const sorted = [...rows].sort((a, b) => {
    switch (filters.sort) {
      case "spend":
        return b.awardedValue - a.awardedValue;
      case "rating":
        return (b.performanceRating ?? -1) - (a.performanceRating ?? -1);
      case "delivery":
        return (b.deliveryReliability ?? -1) - (a.deliveryReliability ?? -1);
      case "oldest":
        return a.createdAt.getTime() - b.createdAt.getTime();
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const categories = Array.from(new Set(vendors.map((v) => v.category))).sort();
  return { rows: sorted, categories, total: sorted.length };
}

export async function getVendor(user: SessionUser, vendorId: string) {
  if (!can(user.role, "vendor:read")) {
    throw new ServiceError("You do not have permission to view vendors.", "FORBIDDEN");
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, orgId: user.orgId },
    include: {
      quotations: {
        include: {
          request: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              estimatedBudget: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      contracts: {
        orderBy: { endDate: "asc" },
      },
      evaluations: {
        include: {
          evaluator: { select: { fullName: true } },
          request: { select: { reference: true, id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      recommendedRequests: {
        select: { id: true, reference: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!vendor) return null;

  const selected = vendor.quotations.filter((q) => q.status === "SELECTED");
  const awardedValue = selected.reduce((sum, q) => sum + (toNumber(q.totalAmount) ?? 0), 0);
  const activeContracts = vendor.contracts.filter((c) => c.status === "ACTIVE" || c.status === "EXPIRING");
  const contractValue = activeContracts.reduce((sum, c) => sum + (toNumber(c.value) ?? 0), 0);

  return { ...vendor, awardedValue, activeContracts, contractValue };
}

function assertVendorWrite(user: SessionUser) {
  if (!can(user.role, "vendor:write")) {
    throw new ServiceError("Only administrators and procurement managers can manage vendors.", "FORBIDDEN");
  }
}

function normalizeVendor(input: VendorInput) {
  return {
    name: input.name,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    category: input.category,
    taxId: input.taxId,
    status: input.status,
    complianceStatus: input.complianceStatus,
    performanceRating: input.performanceRating ?? null,
    deliveryReliability: input.deliveryReliability ?? null,
    notes: input.notes,
  };
}

export async function createVendor(user: SessionUser, input: VendorInput) {
  assertVendorWrite(user);
  try {
    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: { orgId: user.orgId, ...normalizeVendor(input) },
      });
      await recordActivity(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "vendor",
        entityId: created.id,
        action: "created",
        summary: `Added vendor ${created.name}`,
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "vendor",
        entityId: created.id,
        action: "create",
        after: { name: created.name, category: created.category },
      });
      return created;
    });
    return vendor;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("A vendor with this name already exists in your organisation.", "CONFLICT");
    }
    throw error;
  }
}

export async function updateVendor(user: SessionUser, vendorId: string, input: VendorInput) {
  assertVendorWrite(user);
  const existing = await prisma.vendor.findFirst({ where: { id: vendorId, orgId: user.orgId } });
  if (!existing) throw new ServiceError("Vendor not found.", "NOT_FOUND");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendorId },
        data: normalizeVendor(input),
      });
      await recordActivity(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "vendor",
        entityId: vendorId,
        action: "updated",
        summary: `Updated vendor ${input.name}`,
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "vendor",
        entityId: vendorId,
        action: "update",
        before: { name: existing.name, status: existing.status, complianceStatus: existing.complianceStatus },
        after: { name: input.name, status: input.status, complianceStatus: input.complianceStatus },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("Another vendor already uses this name.", "CONFLICT");
    }
    throw error;
  }
}

export async function evaluateVendor(
  user: SessionUser,
  vendorId: string,
  input: { qualityScore: number; deliveryScore: number; complianceScore: number; comment?: string; requestId?: string },
) {
  assertVendorWrite(user);
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, orgId: user.orgId } });
  if (!vendor) throw new ServiceError("Vendor not found.", "NOT_FOUND");
  for (const score of [input.qualityScore, input.deliveryScore, input.complianceScore]) {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new ServiceError("Evaluation scores must be whole numbers between 0 and 100.", "INVALID");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorEvaluation.create({
      data: {
        orgId: user.orgId,
        vendorId,
        evaluatorId: user.id,
        requestId: input.requestId ?? null,
        qualityScore: input.qualityScore,
        deliveryScore: input.deliveryScore,
        complianceScore: input.complianceScore,
        comment: input.comment?.trim() || null,
      },
    });

    const aggregates = await tx.vendorEvaluation.aggregate({
      where: { vendorId },
      _avg: { qualityScore: true, deliveryScore: true },
    });

    await tx.vendor.update({
      where: { id: vendorId },
      data: {
        performanceRating: Math.round(aggregates._avg.qualityScore ?? input.qualityScore),
        deliveryReliability: Math.round(aggregates._avg.deliveryScore ?? input.deliveryScore),
      },
    });

    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "vendor",
      entityId: vendorId,
      requestId: input.requestId ?? null,
      action: "evaluated",
      summary: `Evaluated ${vendor.name} (quality ${input.qualityScore}, delivery ${input.deliveryScore}, compliance ${input.complianceScore})`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "vendor",
      entityId: vendorId,
      action: "evaluate",
      after: { ...input },
    });
  });
}

export async function getVendorCategories(orgId: string) {
  const categories = await prisma.vendor.findMany({
    where: { orgId },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  return categories.map((c) => c.category);
}
