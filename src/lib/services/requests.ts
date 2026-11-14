import type { Prisma, RequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can, canSeeAllRequests } from "@/lib/permissions";
import { requestSchema } from "@/lib/validation/schemas";
import { toNumber } from "@/lib/utils";
import { buildApprovalPlan, type PolicyInput } from "@/lib/approvals/plan";
import { isPdf, makeStorageKey, MAX_UPLOAD_BYTES, putObject } from "@/lib/storage";
import { recordActivity, recordAudit } from "./audit";
import { ServiceError } from "./errors";

export type RequestInput = z.infer<typeof requestSchema>;

const OPEN_STATUSES: RequestStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"];
const EDITABLE_STATUSES: RequestStatus[] = ["DRAFT", "REJECTED"];

export function requestScope(user: SessionUser): Prisma.PurchaseRequestWhereInput {
  if (canSeeAllRequests(user.role)) return { orgId: user.orgId };
  return {
    orgId: user.orgId,
    OR: [
      { requesterId: user.id },
      ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
    ],
  };
}

export async function nextRequestReference(orgId: string) {
  const year = new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const count = await prisma.purchaseRequest.count({ where: { orgId, createdAt: { gte: start } } });
  let n = count + 1;
  for (let i = 0; i < 100; i++) {
    const reference = `PR-${year}-${String(n).padStart(4, "0")}`;
    const exists = await prisma.purchaseRequest.findFirst({
      where: { orgId, reference },
      select: { id: true },
    });
    if (!exists) return reference;
    n += 1;
  }
  return `PR-${year}-${Date.now().toString().slice(-6)}`;
}

function assertCanCreate(user: SessionUser) {
  if (!can(user.role, "request:create")) {
    throw new ServiceError("You do not have permission to create purchase requests.", "FORBIDDEN");
  }
}

function departmentForCreate(user: SessionUser, departmentId: string) {
  if (user.role === "APPROVER" && user.departmentId && departmentId !== user.departmentId) {
    throw new ServiceError("Department managers can only raise requests for their own department.", "FORBIDDEN");
  }
  return departmentId;
}

export async function createPurchaseRequest(user: SessionUser, input: RequestInput) {
  assertCanCreate(user);
  const departmentId = departmentForCreate(user, input.departmentId);

  const department = await prisma.department.findFirst({
    where: { id: departmentId, orgId: user.orgId },
    select: { id: true, name: true },
  });
  if (!department) throw new ServiceError("That department does not exist.", "INVALID");

  const reference = await nextRequestReference(user.orgId);

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseRequest.create({
      data: {
        reference,
        orgId: user.orgId,
        title: input.title,
        description: input.description,
        category: input.category,
        departmentId,
        requesterId: user.id,
        estimatedBudget: input.estimatedBudget,
        priority: input.priority,
        requiredBy: input.requiredBy,
        status: "DRAFT",
        items: {
          create: input.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            estimatedUnitPrice: item.estimatedUnitPrice,
          })),
        },
      },
    });

    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: created.id,
      requestId: created.id,
      action: "created",
      summary: `Created purchase request ${created.reference} in ${department.name}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: created.id,
      action: "create",
      after: { title: created.title, estimatedBudget: input.estimatedBudget, status: "DRAFT" },
    });

    return created;
  });

  return request;
}

async function loadEditableRequest(user: SessionUser, requestId: string) {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    include: { approvalSteps: { select: { status: true } } },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");

  const isOwner = request.requesterId === user.id;
  if (!isOwner && user.role !== "ADMIN") {
    throw new ServiceError("Only the requester or an administrator can change this request.", "FORBIDDEN");
  }

  const hasClarification = request.approvalSteps.some((s) => s.status === "CLARIFICATION_REQUESTED");
  const editable = EDITABLE_STATUSES.includes(request.status) || hasClarification;
  if (!editable) {
    throw new ServiceError(
      "This request can only be edited while it is a draft, rejected, or awaiting clarification.",
      "INVALID",
    );
  }
  return request;
}

export async function updatePurchaseRequest(user: SessionUser, requestId: string, input: RequestInput) {
  const existing = await loadEditableRequest(user, requestId);
  const departmentId = departmentForCreate(user, input.departmentId);
  const department = await prisma.department.findFirst({
    where: { id: departmentId, orgId: user.orgId },
    select: { name: true },
  });
  if (!department) throw new ServiceError("That department does not exist.", "INVALID");

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequestItem.deleteMany({ where: { requestId } });
    await tx.purchaseRequest.update({
      where: { id: requestId },
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        departmentId,
        priority: input.priority,
        estimatedBudget: input.estimatedBudget,
        requiredBy: input.requiredBy,
        items: {
          create: input.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            estimatedUnitPrice: item.estimatedUnitPrice,
          })),
        },
      },
    });

    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      requestId,
      action: "updated",
      summary: `Updated request details for ${existing.reference}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      action: "update",
      before: {
        title: existing.title,
        estimatedBudget: existing.estimatedBudget.toString(),
        departmentId: existing.departmentId,
      },
      after: {
        title: input.title,
        estimatedBudget: input.estimatedBudget,
        departmentId,
      },
    });
  });
}

export async function submitPurchaseRequest(user: SessionUser, requestId: string) {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    include: {
      items: true,
      requester: { select: { fullName: true } },
      department: { select: { name: true, id: true, headId: true } },
    },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");
  if (request.requesterId !== user.id && user.role !== "ADMIN") {
    throw new ServiceError("Only the requester can submit this request.", "FORBIDDEN");
  }
  if (!can(user.role, "request:submit")) {
    throw new ServiceError("You do not have permission to submit requests.", "FORBIDDEN");
  }
  if (!EDITABLE_STATUSES.includes(request.status) && request.status !== "UNDER_REVIEW") {
    throw new ServiceError(`A request in ${request.status.toLowerCase()} status cannot be submitted.`, "INVALID");
  }
  if (!request.items.length) throw new ServiceError("Add at least one line item before submitting.", "INVALID");
  if (request.status === "UNDER_REVIEW") {
    const clarification = await prisma.approvalStep.findFirst({
      where: { requestId, status: "CLARIFICATION_REQUESTED" },
    });
    if (!clarification) {
      throw new ServiceError("This request is already with an approver.", "INVALID");
    }
  }

  const policies = await prisma.approvalWorkflow.findMany({
    where: { orgId: user.orgId, isActive: true },
    orderBy: { minAmount: "asc" },
  });
  const [approvers, admins, procurement] = await Promise.all([
    prisma.profile.findMany({
      where: { orgId: user.orgId, isActive: true, role: "APPROVER", departmentId: request.departmentId },
      orderBy: [{ id: "asc" }],
      select: { id: true },
    }),
    prisma.profile.findMany({
      where: { orgId: user.orgId, isActive: true, role: "ADMIN" },
      select: { id: true },
    }),
    prisma.profile.findMany({
      where: { orgId: user.orgId, isActive: true, role: "PROCUREMENT_MANAGER" },
      select: { id: true },
    }),
  ]);

  const preferredFirst = request.department.headId
    ? [request.department.headId, ...approvers.map((a) => a.id)]
    : approvers.map((a) => a.id);

  const policyInput: PolicyInput[] = policies.map((p) => ({
    id: p.id,
    name: p.name,
    minAmount: toNumber(p.minAmount) ?? 0,
    maxAmount: toNumber(p.maxAmount),
    levels: p.levels,
    secondLevelRole: (p.secondLevelRole ?? "ADMIN") as "ADMIN" | "PROCUREMENT_MANAGER",
    isActive: p.isActive,
  }));

  const plan = buildApprovalPlan({
    amount: toNumber(request.estimatedBudget) ?? 0,
    requesterId: request.requesterId,
    policies: policyInput,
    candidates: {
      departmentApproverIds: preferredFirst,
      adminIds: admins.map((a) => a.id),
      procurementManagerIds: procurement.map((p) => p.id),
    },
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const existingSteps = await tx.approvalStep.findMany({ where: { requestId } });
    const plannedLevels = new Set(plan.steps.map((s) => s.level));

    for (const step of plan.steps) {
      await tx.approvalStep.upsert({
        where: { requestId_level: { requestId, level: step.level } },
        create: {
          requestId,
          level: step.level,
          approverId: step.approverId,
          status: step.level === 1 ? "PENDING" : "WAITING",
          activatedAt: step.level === 1 ? now : null,
        },
        update: {
          approverId: step.approverId,
          status: step.level === 1 ? "PENDING" : "WAITING",
          activatedAt: step.level === 1 ? now : null,
          decidedAt: null,
        },
      });
    }

    for (const step of existingSteps) {
      if (!plannedLevels.has(step.level) && step.status !== "APPROVED") {
        await tx.approvalStep.update({
          where: { id: step.id },
          data: { status: "SKIPPED", decidedAt: null },
        });
      }
    }

    await tx.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        rejectionReason: null,
        cancellationReason: null,
      },
    });

    if (request.status === "REJECTED" || request.status === "UNDER_REVIEW") {
      await tx.approvalAction.create({
        data: { requestId, actorId: user.id, action: "RESUBMIT", comment: null },
      });
    }

    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      requestId,
      action: "submitted",
      summary: `Submitted ${request.reference} for approval (${plan.steps.length} level${plan.steps.length > 1 ? "s" : ""} · ${plan.policy?.name ?? "standard policy"})`,
      metadata: { levels: plan.steps.length, policy: plan.policy?.name ?? null },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      action: "submit",
      before: { status: request.status },
      after: { status: "SUBMITTED", levels: plan.steps.length, policy: plan.policy?.name ?? null },
    });
  });

  return { levels: plan.steps.length, policy: plan.policy?.name ?? "Standard policy" };
}

export async function cancelPurchaseRequest(user: SessionUser, requestId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 5) throw new ServiceError("Give a cancellation reason of at least 5 characters.", "INVALID");

  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    select: {
      id: true,
      reference: true,
      status: true,
      requesterId: true,
      approvalSteps: { select: { id: true, status: true } },
    },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");
  const allowed = request.requesterId === user.id || user.role === "ADMIN" || user.role === "PROCUREMENT_MANAGER";
  if (!allowed) throw new ServiceError("You cannot cancel this request.", "FORBIDDEN");
  if (!OPEN_STATUSES.includes(request.status) && request.status !== "SOURCING") {
    throw new ServiceError(`A ${request.status.toLowerCase()} request cannot be cancelled.`, "INVALID");
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalStep.updateMany({
      where: { requestId, status: { in: ["PENDING", "WAITING", "CLARIFICATION_REQUESTED"] } },
      data: { status: "SKIPPED" },
    });
    await tx.purchaseRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", cancellationReason: trimmed },
    });
    await tx.approvalAction.create({
      data: { requestId, actorId: user.id, action: "CANCEL", comment: trimmed },
    });
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      requestId,
      action: "cancelled",
      summary: `Cancelled ${request.reference}: ${trimmed}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      action: "cancel",
      before: { status: request.status },
      after: { status: "CANCELLED", reason: trimmed },
    });
  });
}

export async function deletePurchaseRequest(user: SessionUser, requestId: string) {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    select: { id: true, reference: true, status: true, requesterId: true },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");
  if (request.requesterId !== user.id && user.role !== "ADMIN") {
    throw new ServiceError("Only the requester or an administrator can delete this request.", "FORBIDDEN");
  }
  if (request.status !== "DRAFT") {
    throw new ServiceError("Only draft requests can be deleted. Cancel the request instead.", "INVALID");
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      action: "delete",
      before: { reference: request.reference, status: request.status },
    });
    await tx.purchaseRequest.delete({ where: { id: requestId } });
  });
}

export async function advancePurchaseRequest(user: SessionUser, requestId: string, action: "START_SOURCING" | "COMPLETE") {
  if (!can(user.role, "request:update") || !can(user.role, "quotation:write")) {
    throw new ServiceError("Only procurement can move a request into sourcing or completion.", "FORBIDDEN");
  }
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, orgId: user.orgId },
    include: {
      quotations: { where: { status: "SELECTED" }, select: { id: true } },
      recommendedVendor: { select: { name: true } },
    },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");

  if (action === "START_SOURCING") {
    if (request.status !== "APPROVED") {
      throw new ServiceError("Only approved requests can move into sourcing.", "INVALID");
    }
    await prisma.$transaction(async (tx) => {
      await tx.purchaseRequest.update({ where: { id: requestId }, data: { status: "SOURCING" } });
      await recordActivity(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "purchase_request",
        entityId: requestId,
        requestId,
        action: "sourcing",
        summary: `Started sourcing for ${request.reference}`,
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "purchase_request",
        entityId: requestId,
        action: "start_sourcing",
        before: { status: "APPROVED" },
        after: { status: "SOURCING" },
      });
    });
    return;
  }

  if (request.status !== "SOURCING") {
    throw new ServiceError("Only requests in sourcing can be completed.", "INVALID");
  }
  if (!request.quotations.length) {
    throw new ServiceError("Select a winning quotation before completing this purchase.", "INVALID");
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      requestId,
      action: "completed",
      summary: `Completed ${request.reference} with ${request.recommendedVendor?.name ?? "the selected vendor"}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      action: "complete",
      before: { status: "SOURCING" },
      after: { status: "COMPLETED" },
    });
  });
}

export type RequestListFilters = {
  q?: string;
  status?: string;
  departmentId?: string;
  priority?: string;
  sort?: string;
  page?: number;
  perPage?: number;
};

export async function listPurchaseRequests(user: SessionUser, filters: RequestListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(50, Math.max(5, filters.perPage ?? 10));

  const where: Prisma.PurchaseRequestWhereInput = {
    AND: [
      requestScope(user),
      {
        ...(filters.status && filters.status !== "ALL" ? { status: filters.status as RequestStatus } : {}),
        ...(filters.departmentId && filters.departmentId !== "ALL"
          ? { departmentId: filters.departmentId }
          : {}),
        ...(filters.priority && filters.priority !== "ALL" ? { priority: filters.priority as "LOW" } : {}),
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: "insensitive" as const } },
                { reference: { contains: filters.q, mode: "insensitive" as const } },
                { description: { contains: filters.q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
    ],
  };

  const orderBy: Prisma.PurchaseRequestOrderByWithRelationInput =
    filters.sort === "oldest"
      ? { createdAt: "asc" }
      : filters.sort === "budget"
        ? { estimatedBudget: "desc" }
        : filters.sort === "title"
          ? { title: "asc" }
          : { createdAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        department: { select: { id: true, name: true, code: true } },
        requester: { select: { id: true, fullName: true } },
        _count: { select: { quotations: true } },
      },
    }),
    prisma.purchaseRequest.count({ where }),
  ]);

  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getPurchaseRequest(user: SessionUser, requestId: string) {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    include: {
      department: true,
      requester: true,
      items: { orderBy: { id: "asc" } },
      recommendedVendor: true,
      documents: { include: { uploadedBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      quotations: {
        include: {
          vendor: true,
          items: true,
          documents: { select: { id: true, fileName: true, extractionStatus: true, createdAt: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      approvalSteps: {
        include: { approver: { select: { id: true, fullName: true, role: true, title: true } } },
        orderBy: { level: "asc" },
      },
      approvalActions: {
        include: { actor: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      activities: {
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
  return request;
}

export async function getRequestFormOptions(user: SessionUser) {
  const [departments, vendors] = await Promise.all([
    prisma.department.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.vendor.findMany({
      where: { orgId: user.orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    }),
  ]);
  return { departments, vendors };
}

export async function addRequestDocument(
  user: SessionUser,
  requestId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
) {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    select: { id: true, reference: true, requesterId: true, status: true },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");
  const allowed =
    request.requesterId === user.id || user.role === "ADMIN" || user.role === "PROCUREMENT_MANAGER";
  if (!allowed) throw new ServiceError("You cannot attach documents to this request.", "FORBIDDEN");
  if (["CANCELLED", "COMPLETED"].includes(request.status)) {
    throw new ServiceError("This request is closed and no longer accepts documents.", "INVALID");
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new ServiceError("Upload a PDF smaller than 10 MB.", "INVALID");
  }
  if (!isPdf(file)) throw new ServiceError("Only PDF files are accepted.", "INVALID");

  const key = makeStorageKey({ orgId: user.orgId, kind: "requests", id: requestId, fileName: file.name });
  await putObject(key, file.buffer);

  return prisma.$transaction(async (tx) => {
    const document = await tx.requestDocument.create({
      data: {
        requestId,
        fileName: file.name.slice(0, 180),
        storageKey: key,
        mimeType: "application/pdf",
        sizeBytes: file.size,
        uploadedById: user.id,
      },
    });
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      requestId,
      action: "document_uploaded",
      summary: `Attached ${document.fileName} to ${request.reference}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request_document",
      entityId: document.id,
      action: "upload",
      after: { fileName: document.fileName, sizeBytes: file.size },
    });
    return document;
  });
}

export async function getRequestDocument(user: SessionUser, documentId: string) {
  const document = await prisma.requestDocument.findUnique({
    where: { id: documentId },
    include: { request: { select: { orgId: true, id: true, requesterId: true, departmentId: true } } },
  });
  if (!document || document.request.orgId !== user.orgId) return null;
  const requiresScope = canSeeAllRequests(user.role);
  const visible =
    requiresScope ||
    document.request.requesterId === user.id ||
    (user.departmentId !== null && document.request.departmentId === user.departmentId);
  if (!visible) return null;
  return document;
}

export function requestProgress(status: RequestStatus) {
  switch (status) {
    case "DRAFT":
      return 10;
    case "SUBMITTED":
      return 30;
    case "UNDER_REVIEW":
      return 50;
    case "APPROVED":
      return 70;
    case "SOURCING":
      return 85;
    case "COMPLETED":
      return 100;
    case "REJECTED":
      return 60;
    case "CANCELLED":
      return 100;
    default:
      return 0;
  }
}
