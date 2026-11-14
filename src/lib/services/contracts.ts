import { z } from "zod";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contractSchema } from "@/lib/validation/schemas";
import { daysUntil, toNumber } from "@/lib/utils";
import { getObject, isPdf, makeStorageKey, MAX_UPLOAD_BYTES, putObject } from "@/lib/storage";
import { recordActivity, recordAudit } from "./audit";
import { ServiceError } from "./errors";

export type ContractInput = z.infer<typeof contractSchema>;

export type ContractDisplayStatus = "DRAFT" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWED" | "TERMINATED";

export function derivedContractStatus(
  contract: { status: string; endDate: Date; renewalDate: Date | null },
  now = new Date(),
): ContractDisplayStatus {
  if (["TERMINATED", "RENEWED", "DRAFT"].includes(contract.status)) {
    return contract.status as ContractDisplayStatus;
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (contract.endDate.getTime() < today.getTime()) return "EXPIRED";
  const watch = contract.renewalDate ?? contract.endDate;
  const days = daysUntil(watch);
  if (days !== null && days <= 90) return "EXPIRING";
  return "ACTIVE";
}

function assertWrite(user: SessionUser) {
  if (!can(user.role, "contract:write")) {
    throw new ServiceError("Only administrators and procurement managers can manage contracts.", "FORBIDDEN");
  }
}

export async function listContracts(
  user: SessionUser,
  filters: { q?: string; status?: string; window?: string; vendorId?: string } = {},
) {
  if (!can(user.role, "contract:read")) {
    throw new ServiceError("You do not have permission to view contracts.", "FORBIDDEN");
  }

  const contracts = await prisma.contract.findMany({
    where: { orgId: user.orgId },
    include: {
      vendor: { select: { id: true, name: true, category: true } },
      owner: { select: { fullName: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const withStatus = contracts.map((contract) => ({
    ...contract,
    displayStatus: derivedContractStatus(contract),
    daysToExpiry: daysUntil(contract.endDate),
    daysToRenewal: daysUntil(contract.renewalDate ?? contract.endDate),
  }));

  const q = filters.q?.trim().toLowerCase();
  const filtered = withStatus.filter((contract) => {
    if (q && ![contract.title, contract.vendor.name, contract.vendor.category].some((v) => v.toLowerCase().includes(q))) {
      return false;
    }
    if (filters.status && filters.status !== "ALL" && contract.displayStatus !== filters.status) return false;
    if (filters.vendorId && filters.vendorId !== "ALL" && contract.vendorId !== filters.vendorId) return false;
    if (filters.window && filters.window !== "all") {
      if (filters.window === "expired") return contract.displayStatus === "EXPIRED";
      if (contract.displayStatus === "TERMINATED" || contract.displayStatus === "RENEWED") return false;
      const limit = Number(filters.window);
      const days = contract.daysToRenewal ?? contract.daysToExpiry;
      if (days === null || days < 0 || days > limit) return false;
    }
    return true;
  });

  const summary = {
    active: withStatus.filter((c) => c.displayStatus === "ACTIVE").length,
    expiringSoon: withStatus.filter((c) => c.displayStatus === "EXPIRING").length,
    expired: withStatus.filter((c) => c.displayStatus === "EXPIRED").length,
    totalValue: withStatus
      .filter((c) => !["TERMINATED", "EXPIRED"].includes(c.displayStatus))
      .reduce((sum, c) => sum + (toNumber(c.value) ?? 0), 0),
    renewalRiskValue: withStatus
      .filter((c) => c.displayStatus === "EXPIRING")
      .reduce((sum, c) => sum + (toNumber(c.value) ?? 0), 0),
  };

  return { items: filtered, summary };
}

export async function getContract(user: SessionUser, contractId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, orgId: user.orgId },
    include: {
      vendor: true,
      owner: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!contract) return null;
  return {
    ...contract,
    displayStatus: derivedContractStatus(contract),
    daysToExpiry: daysUntil(contract.endDate),
    daysToRenewal: daysUntil(contract.renewalDate ?? contract.endDate),
  };
}

export async function createContract(user: SessionUser, input: ContractInput) {
  assertWrite(user);
  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendorId, orgId: user.orgId },
    select: { id: true, name: true },
  });
  if (!vendor) throw new ServiceError("Vendor not found.", "NOT_FOUND");
  if (input.renewalDate && input.renewalDate < input.startDate) {
    throw new ServiceError("Renewal date cannot be before the start date.", "INVALID");
  }

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        orgId: user.orgId,
        vendorId: input.vendorId,
        ownerId: user.id,
        title: input.title,
        value: input.value,
        startDate: input.startDate,
        endDate: input.endDate,
        renewalDate: input.renewalDate ?? null,
        status: input.status,
        notes: input.notes,
      },
    });
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "contract",
      entityId: contract.id,
      action: "created",
      summary: `Registered contract "${contract.title}" with ${vendor.name}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "contract",
      entityId: contract.id,
      action: "create",
      after: { title: contract.title, value: toNumber(contract.value), vendor: vendor.name },
    });
    return contract;
  });
}

export async function updateContract(user: SessionUser, contractId: string, input: ContractInput) {
  assertWrite(user);
  const existing = await prisma.contract.findFirst({
    where: { id: contractId, orgId: user.orgId },
    include: { vendor: { select: { name: true } } },
  });
  if (!existing) throw new ServiceError("Contract not found.", "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: {
        title: input.title,
        vendorId: input.vendorId,
        value: input.value,
        startDate: input.startDate,
        endDate: input.endDate,
        renewalDate: input.renewalDate ?? null,
        status: input.status,
        notes: input.notes,
      },
    });
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "contract",
      entityId: contractId,
      action: "updated",
      summary: `Updated contract "${input.title}"`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "contract",
      entityId: contractId,
      action: "update",
      before: { title: existing.title, value: toNumber(existing.value), status: existing.status },
      after: { title: input.title, value: input.value, status: input.status },
    });
  });
}

export async function renewContract(user: SessionUser, contractId: string, months = 12) {
  assertWrite(user);
  const existing = await prisma.contract.findFirst({
    where: { id: contractId, orgId: user.orgId },
  });
  if (!existing) throw new ServiceError("Contract not found.", "NOT_FOUND");

  const nextEnd = new Date(existing.endDate);
  nextEnd.setUTCMonth(nextEnd.getUTCMonth() + months);
  const nextRenewal = new Date(existing.renewalDate ?? existing.endDate);
  nextRenewal.setUTCMonth(nextRenewal.getUTCMonth() + months);

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: { endDate: nextEnd, renewalDate: nextRenewal, status: "ACTIVE" },
    });
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "contract",
      entityId: contractId,
      action: "renewed",
      summary: `Renewed "${existing.title}" for ${months} months to ${nextEnd.toISOString().slice(0, 10)}`,
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "contract",
      entityId: contractId,
      action: "renew",
      before: { endDate: existing.endDate.toISOString(), status: existing.status },
      after: { endDate: nextEnd.toISOString(), status: "ACTIVE" },
    });
  });
}

export async function addContractDocument(
  user: SessionUser,
  contractId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
) {
  assertWrite(user);
  const contract = await prisma.contract.findFirst({ where: { id: contractId, orgId: user.orgId } });
  if (!contract) throw new ServiceError("Contract not found.", "NOT_FOUND");
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new ServiceError("Upload a PDF smaller than 10 MB.", "INVALID");
  }
  if (!isPdf(file)) throw new ServiceError("Only PDF files are accepted.", "INVALID");

  const key = makeStorageKey({ orgId: user.orgId, kind: "contracts", id: contractId, fileName: file.name });
  await putObject(key, file.buffer);

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: { documentKey: key, documentName: file.name.slice(0, 180) },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "contract",
      entityId: contractId,
      action: "attach_document",
      after: { fileName: file.name, sizeBytes: file.size },
    });
  });
}

export async function getContractDocument(user: SessionUser, contractId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, orgId: user.orgId },
  });
  if (!contract?.documentKey) return null;
  return {
    fileName: contract.documentName ?? "contract.pdf",
    buffer: await getObject(contract.documentKey),
  };
}

export async function getVendorOptionsForContracts(user: SessionUser) {
  return prisma.vendor.findMany({
    where: { orgId: user.orgId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
