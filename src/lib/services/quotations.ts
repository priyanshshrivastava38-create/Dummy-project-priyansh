import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { quotationSchema } from "@/lib/validation/schemas";
import { toNumber } from "@/lib/utils";
import { extractQuotationData } from "@/lib/ai/extract";
import { ExtractionError } from "@/lib/ai/schema";
import { extractPdfText } from "@/lib/pdf";
import { getObject, isPdf, makeStorageKey, MAX_UPLOAD_BYTES, putObject } from "@/lib/storage";
import { recordActivity, recordAudit } from "./audit";
import { ServiceError, errorMessage } from "./errors";

export type QuotationInput = z.infer<typeof quotationSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const QUOTABLE_REQUEST_STATUSES = ["APPROVED", "SOURCING"] as const;

export function computeQuotationTotals(
  items: { quantity: number; unitPrice: number }[],
  taxAmount: number | null | undefined,
  additionalCharges: number | null | undefined,
  fallbackTotal: number | null | undefined,
) {
  const tax = taxAmount ?? 0;
  const charges = additionalCharges ?? 0;
  if (items.length) {
    const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    return { subtotal, total: round2(subtotal + tax + charges) };
  }
  return { subtotal: null, total: fallbackTotal ?? null };
}

function assertQuotationWrite(user: SessionUser) {
  if (!can(user.role, "quotation:write")) {
    throw new ServiceError("Only administrators and procurement managers can manage quotations.", "FORBIDDEN");
  }
}

async function loadQuotationContext(user: SessionUser, quotationId: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, orgId: user.orgId },
    include: {
      request: { select: { id: true, reference: true, title: true, status: true, estimatedBudget: true } },
      vendor: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!quotation) throw new ServiceError("Quotation not found.", "NOT_FOUND");
  return quotation;
}

export async function createQuotation(user: SessionUser, requestId: string, input: QuotationInput) {
  assertQuotationWrite(user);

  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, orgId: user.orgId },
    select: { id: true, reference: true, title: true, status: true },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");
  if (!QUOTABLE_REQUEST_STATUSES.includes(request.status as (typeof QUOTABLE_REQUEST_STATUSES)[number])) {
    throw new ServiceError("Quotations can be added once the request is approved for sourcing.", "INVALID");
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendorId, orgId: user.orgId },
    select: { id: true, name: true, status: true },
  });
  if (!vendor) throw new ServiceError("Vendor not found.", "NOT_FOUND");
  if (vendor.status === "INACTIVE") {
    throw new ServiceError("This vendor is inactive. Reactivate it before recording a quotation.", "INVALID");
  }

  if (!input.items.length && input.totalAmount == null) {
    throw new ServiceError("Add line items or a total amount for the quotation.", "INVALID");
  }

  const totals = computeQuotationTotals(input.items, input.taxAmount, input.additionalCharges, input.totalAmount);

  try {
    const quotation = await prisma.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          orgId: user.orgId,
          requestId,
          vendorId: input.vendorId,
          currency: user.currency,
          subtotal: totals.subtotal,
          taxAmount: input.taxAmount ?? null,
          additionalCharges: input.additionalCharges ?? null,
          totalAmount: totals.total,
          deliveryDays: input.deliveryDays ?? null,
          paymentTerms: input.paymentTerms,
          warrantyMonths: input.warrantyMonths ?? null,
          validityDate: input.validityDate,
          notes: input.notes,
          extractionSource: "MANUAL",
          items: {
            create: input.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: round2(item.quantity * item.unitPrice),
            })),
          },
        },
      });

      await recordActivity(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "quotation",
        entityId: created.id,
        requestId,
        action: "quotation_added",
        summary: `Recorded a manual quotation from ${vendor.name} for ${request.reference}`,
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "quotation",
        entityId: created.id,
        action: "create",
        after: { vendor: vendor.name, total: totals.total, source: "MANUAL" },
      });
      return created;
    });

    return quotation;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("This vendor already has a quotation for this request.", "CONFLICT");
    }
    throw error;
  }
}

export async function updateQuotation(user: SessionUser, quotationId: string, input: QuotationInput) {
  assertQuotationWrite(user);
  const existing = await loadQuotationContext(user, quotationId);
  if (["CANCELLED", "COMPLETED", "REJECTED", "DRAFT"].includes(existing.request.status)) {
    throw new ServiceError("This quotation can no longer be edited.", "INVALID");
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendorId, orgId: user.orgId },
    select: { id: true, name: true },
  });
  if (!vendor) throw new ServiceError("Vendor not found.", "NOT_FOUND");
  if (!input.items.length && input.totalAmount == null) {
    throw new ServiceError("Add line items or a total amount for the quotation.", "INVALID");
  }

  const totals = computeQuotationTotals(input.items, input.taxAmount, input.additionalCharges, input.totalAmount);
  const nextSource = existing.extractionSource === "MANUAL" ? "MANUAL" : "AI_CORRECTED";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId } });
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          vendorId: input.vendorId,
          subtotal: totals.subtotal,
          taxAmount: input.taxAmount ?? null,
          additionalCharges: input.additionalCharges ?? null,
          totalAmount: totals.total,
          deliveryDays: input.deliveryDays ?? null,
          paymentTerms: input.paymentTerms,
          warrantyMonths: input.warrantyMonths ?? null,
          validityDate: input.validityDate,
          notes: input.notes,
          extractionSource: nextSource,
          items: {
            create: input.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: round2(item.quantity * item.unitPrice),
            })),
          },
        },
      });

      await recordActivity(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "quotation",
        entityId: quotationId,
        requestId: existing.requestId,
        action: "quotation_updated",
        summary: `Updated the ${vendor.name} quotation for ${existing.request.reference}`,
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "quotation",
        entityId: quotationId,
        action: "update",
        before: {
          total: toNumber(existing.totalAmount),
          deliveryDays: existing.deliveryDays,
          source: existing.extractionSource,
        },
        after: {
          total: totals.total,
          deliveryDays: input.deliveryDays ?? null,
          source: nextSource,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("Another quotation from this vendor already exists for the request.", "CONFLICT");
    }
    throw error;
  }
}

export async function selectQuotation(user: SessionUser, quotationId: string) {
  if (!can(user.role, "quotation:select")) {
    throw new ServiceError("Only procurement can record a vendor decision.", "FORBIDDEN");
  }
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, orgId: user.orgId },
    include: {
      vendor: { select: { name: true } },
      request: { select: { id: true, reference: true, status: true } },
    },
  });
  if (!quotation) throw new ServiceError("Quotation not found.", "NOT_FOUND");
  if (!["APPROVED", "SOURCING"].includes(quotation.request.status)) {
    throw new ServiceError("A vendor can only be selected while the request is approved or sourcing.", "INVALID");
  }

  await prisma.$transaction(async (tx) => {
    await tx.quotation.updateMany({
      where: { requestId: quotation.requestId },
      data: { status: "NOT_SELECTED" },
    });
    await tx.quotation.update({ where: { id: quotationId }, data: { status: "SELECTED" } });
    await tx.purchaseRequest.update({
      where: { id: quotation.requestId },
      data: { recommendedVendorId: quotation.vendorId },
    });
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "quotation",
      entityId: quotationId,
      requestId: quotation.requestId,
      action: "vendor_selected",
      summary: `Selected ${quotation.vendor.name} for ${quotation.request.reference}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "quotation",
      entityId: quotationId,
      action: "select",
      after: { vendor: quotation.vendor.name, requestReference: quotation.request.reference },
    });
  });
}

export async function addQuotationDocument(
  user: SessionUser,
  quotationId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
) {
  assertQuotationWrite(user);
  const quotation = await loadQuotationContext(user, quotationId);
  if (!QUOTABLE_REQUEST_STATUSES.includes(quotation.request.status as (typeof QUOTABLE_REQUEST_STATUSES)[number])) {
    throw new ServiceError("Documents can only be added while the request is approved or sourcing.", "INVALID");
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new ServiceError("Upload a PDF smaller than 10 MB.", "INVALID");
  }
  if (!isPdf(file)) {
    throw new ServiceError("Only PDF quotations are accepted.", "INVALID");
  }

  const key = makeStorageKey({
    orgId: user.orgId,
    kind: "quotations",
    id: quotationId,
    fileName: file.name,
  });
  await putObject(key, file.buffer);

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.quotationDocument.create({
      data: {
        quotationId,
        fileName: file.name.slice(0, 180),
        storageKey: key,
        mimeType: "application/pdf",
        sizeBytes: file.size,
        uploadedById: user.id,
        extractionStatus: "PENDING",
      },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "quotation_document",
      entityId: created.id,
      action: "upload",
      after: { fileName: created.fileName, sizeBytes: file.size },
    });
    return created;
  });

  return document;
}

export async function extractQuotationDocument(user: SessionUser, documentId: string) {
  assertQuotationWrite(user);
  const document = await prisma.quotationDocument.findUnique({
    where: { id: documentId },
    include: {
      quotation: {
        include: {
          vendor: { select: { id: true, name: true } },
          request: { select: { id: true, reference: true, status: true } },
        },
      },
    },
  });
  if (!document || document.quotation.orgId !== user.orgId) {
    throw new ServiceError("Document not found.", "NOT_FOUND");
  }
  if (!["APPROVED", "SOURCING"].includes(document.quotation.request.status)) {
    throw new ServiceError("This request is no longer accepting quotation changes.", "INVALID");
  }

  await prisma.quotationDocument.update({
    where: { id: documentId },
    data: { extractionStatus: "PROCESSING", extractionError: null },
  });

  try {
    const buffer = await getObject(document.storageKey);
    const text = await extractPdfText(buffer);
    if (text.length < 40) {
      throw new ExtractionError(
        "No selectable text found. This looks like a scanned PDF — enter the quotation manually and keep the original document attached.",
        "document",
      );
    }

    const outcome = await extractQuotationData(text, document.fileName);
    const extraction = outcome.extraction;
    const mismatchWarnings = [...extraction.warnings];

    if (
      extraction.vendorName &&
      !extraction.vendorName.toLowerCase().includes(document.quotation.vendor.name.toLowerCase().split(" ")[0]) &&
      !document.quotation.vendor.name.toLowerCase().includes(extraction.vendorName.toLowerCase().split(" ")[0])
    ) {
      mismatchWarnings.push(
        `The document names "${extraction.vendorName}" but this quotation is linked to ${document.quotation.vendor.name}. Confirm the document belongs to this vendor.`,
      );
    }

    // Only persist item rows that actually contain a description, quantity and
    // price. Incomplete rows stay visible in extractedData and are flagged.
    const completeItems = extraction.items.filter(
      (item): item is { description: string; quantity: number; unitPrice: number; total: number | null } =>
        Boolean(item.description) && item.quantity !== null && item.quantity > 0 && item.unitPrice !== null,
    );

    let dbItems = completeItems.map((item) => ({
      description: item.description!,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: round2(item.quantity * item.unitPrice),
    }));

    if (!dbItems.length && extraction.productDescription && extraction.quantity && extraction.unitPrice !== null) {
      dbItems = [
        {
          description: extraction.productDescription,
          quantity: Math.round(extraction.quantity),
          unitPrice: extraction.unitPrice,
          total: round2(Math.round(extraction.quantity) * extraction.unitPrice),
        },
      ];
    }

    const computed = computeQuotationTotals(
      dbItems,
      extraction.taxAmount,
      extraction.additionalCharges,
      extraction.totalAmount,
    );
    const totalAmount = extraction.totalAmount ?? computed.total;
    const subtotal = extraction.subtotal ?? computed.subtotal;
    const incompleteItemCount = extraction.items.length - completeItems.length;
    if (incompleteItemCount > 0) {
      mismatchWarnings.push(
        `${incompleteItemCount} extracted line item${incompleteItemCount === 1 ? "" : "s"} lacked a quantity or price and ${incompleteItemCount === 1 ? "was" : "were"} not imported into the structured lines.`,
      );
    }

    const extractedData = {
      provider: outcome.provider,
      extractedAt: new Date().toISOString(),
      documentName: document.fileName,
      vendorName: extraction.vendorName,
      productDescription: extraction.productDescription,
      deliveryTimeline: extraction.deliveryTimeline,
      notes: extraction.notes,
      currency: extraction.currency ?? user.currency,
      items: extraction.items,
      confidence: extraction.confidence,
      missingFields: extraction.missingFields,
      warnings: mismatchWarnings,
    };

    await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: document.quotationId } });
      await tx.quotation.update({
        where: { id: document.quotationId },
        data: {
          subtotal,
          taxAmount: extraction.taxAmount,
          additionalCharges: extraction.additionalCharges,
          totalAmount,
          deliveryDays: extraction.deliveryDays,
          paymentTerms: extraction.paymentTerms,
          warrantyMonths: extraction.warrantyMonths,
          validityDate: extraction.validityDate ? new Date(`${extraction.validityDate}T12:00:00.000Z`) : null,
          extractionSource: "AI",
          extractionConfidence: extraction.overallConfidence,
          extractionModel: `${outcome.provider.label} · ${outcome.provider.model}`,
          extractedData,
          items: dbItems.length
            ? { create: dbItems.map((item) => ({ ...item, total: round2(item.total) })) }
            : undefined,
        },
      });
      await tx.quotationDocument.update({
        where: { id: documentId },
        data: {
          extractionStatus: "EXTRACTED",
          extractionError: null,
          extractedText: text.slice(0, 300_000),
        },
      });
      await recordActivity(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "quotation",
        entityId: document.quotationId,
        requestId: document.quotation.requestId,
        action: "quotation_extracted",
        summary: `Extracted ${document.fileName} for ${document.quotation.vendor.name} with ${outcome.provider.label}`,
        metadata: { confidence: extraction.overallConfidence, missing: extraction.missingFields },
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "quotation_document",
        entityId: documentId,
        action: "extract",
        after: {
          provider: outcome.provider.id,
          model: outcome.provider.model,
          confidence: extraction.overallConfidence,
          missingFields: extraction.missingFields,
        },
      });
    });

    return {
      extraction: { ...extraction, warnings: mismatchWarnings },
      provider: outcome.provider,
    };
  } catch (error) {
    const message =
      error instanceof ExtractionError || error instanceof ServiceError
        ? error.message
        : `Extraction failed: ${errorMessage(error)}`;
    await prisma.quotationDocument.update({
      where: { id: documentId },
      data: { extractionStatus: "FAILED", extractionError: message.slice(0, 1000) },
    });
    await recordActivity(prisma, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "quotation_document",
      entityId: documentId,
      requestId: document.quotation.requestId,
      action: "extraction_failed",
      summary: `Extraction failed for ${document.fileName}. The original document was kept.`,
    }).catch(() => undefined);
    throw new ServiceError(message, "INVALID");
  }
}

export async function getQuotationDocument(user: SessionUser, documentId: string) {
  const document = await prisma.quotationDocument.findUnique({
    where: { id: documentId },
    include: {
      quotation: {
        include: { request: { select: { id: true, orgId: true, requesterId: true, departmentId: true } } },
      },
    },
  });
  if (!document || document.quotation.orgId !== user.orgId) return null;

  const request = document.quotation.request;
  const visible =
    user.role === "ADMIN" ||
    user.role === "PROCUREMENT_MANAGER" ||
    request.requesterId === user.id ||
    (user.departmentId !== null && request.departmentId === user.departmentId);
  if (!visible) return null;
  return document;
}

export async function getQuotationForEdit(user: SessionUser, quotationId: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, orgId: user.orgId },
    include: {
      vendor: { select: { id: true, name: true } },
      items: { orderBy: { id: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      request: {
        select: { id: true, reference: true, title: true, status: true },
      },
    },
  });
  return quotation;
}
