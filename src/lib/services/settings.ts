import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  departmentSchema,
  policySchema,
  userAdminSchema,
  weightsSchema,
} from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "./audit";
import { ServiceError } from "./errors";

function assertAdmin(user: SessionUser) {
  if (!can(user.role, "settings:manage")) {
    throw new ServiceError("Only administrators can change organisation settings.", "FORBIDDEN");
  }
}

export async function getSettingsData(user: SessionUser) {
  assertAdmin(user);
  const [organisation, users, departments, policies] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: user.orgId } }),
    prisma.profile.findMany({
      where: { orgId: user.orgId },
      include: { department: { select: { id: true, name: true } } },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    }),
    prisma.department.findMany({
      where: { orgId: user.orgId },
      include: {
        _count: { select: { members: true, requests: true } },
        head: { select: { id: true, fullName: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.approvalWorkflow.findMany({ where: { orgId: user.orgId }, orderBy: { minAmount: "asc" } }),
  ]);
  if (!organisation) throw new ServiceError("Organisation not found.", "NOT_FOUND");
  return { organisation, users, departments, policies };
}

export async function createUser(user: SessionUser, input: z.infer<typeof userAdminSchema> & { password: string }) {
  assertAdmin(user);
  if (!input.password || input.password.length < 8) {
    throw new ServiceError("Set a password of at least 8 characters for the new user.", "INVALID");
  }
  if (input.role === "APPROVER" && !input.departmentId) {
    throw new ServiceError("Department managers need a department.", "INVALID");
  }
  if (input.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: input.departmentId, orgId: user.orgId },
      select: { id: true },
    });
    if (!dept) throw new ServiceError("Department not found.", "NOT_FOUND");
  }

  try {
    const passwordHash = await hashPassword(input.password);
    const created = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          orgId: user.orgId,
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          role: input.role,
          departmentId: input.departmentId || null,
          isActive: input.isActive,
        },
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "profile",
        entityId: profile.id,
        action: "create_user",
        after: { email: profile.email, role: profile.role, departmentId: profile.departmentId },
      });
      return profile;
    });
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("A user with this email already exists.", "CONFLICT");
    }
    throw error;
  }
}

export async function updateUserAdmin(
  user: SessionUser,
  userId: string,
  input: z.infer<typeof userAdminSchema> & { password?: string },
) {
  assertAdmin(user);
  const existing = await prisma.profile.findFirst({
    where: { id: userId, orgId: user.orgId },
  });
  if (!existing) throw new ServiceError("User not found.", "NOT_FOUND");

  if (existing.role === "ADMIN" && (input.role !== "ADMIN" || !input.isActive)) {
    const otherAdmins = await prisma.profile.count({
      where: { orgId: user.orgId, role: "ADMIN", isActive: true, id: { not: existing.id } },
    });
    if (otherAdmins === 0) {
      throw new ServiceError("At least one active administrator must remain.", "INVALID");
    }
  }
  if (existing.id === user.id && !input.isActive) {
    throw new ServiceError("You cannot deactivate your own account.", "INVALID");
  }
  if (input.role === "APPROVER" && !input.departmentId) {
    throw new ServiceError("Department managers need a department.", "INVALID");
  }

  const data: Prisma.ProfileUpdateInput = {
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    isActive: input.isActive,
    department: input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true },
  };
  if (input.password?.trim()) {
    data.passwordHash = await hashPassword(input.password);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.profile.update({ where: { id: userId }, data });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "profile",
        entityId: userId,
        action: "update_user",
        before: {
          fullName: existing.fullName,
          role: existing.role,
          isActive: existing.isActive,
          departmentId: existing.departmentId,
        },
        after: {
          fullName: input.fullName,
          role: input.role,
          isActive: input.isActive,
          departmentId: input.departmentId || null,
          passwordChanged: Boolean(input.password?.trim()),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("Another user already uses this email.", "CONFLICT");
    }
    throw error;
  }
}

export async function createDepartment(user: SessionUser, input: z.infer<typeof departmentSchema>) {
  assertAdmin(user);
  try {
    return await prisma.department.create({
      data: {
        orgId: user.orgId,
        name: input.name,
        code: input.code,
        annualBudget: input.annualBudget ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("A department with this code already exists.", "CONFLICT");
    }
    throw error;
  }
}

export async function updateDepartment(user: SessionUser, departmentId: string, input: z.infer<typeof departmentSchema>) {
  assertAdmin(user);
  const department = await prisma.department.findFirst({
    where: { id: departmentId, orgId: user.orgId },
    select: { id: true, name: true, code: true, annualBudget: true },
  });
  if (!department) throw new ServiceError("Department not found.", "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.department.update({
      where: { id: departmentId },
      data: { name: input.name, code: input.code, annualBudget: input.annualBudget ?? null },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "department",
      entityId: departmentId,
      action: "update",
      before: { name: department.name, code: department.code, annualBudget: toNumber(department.annualBudget) },
      after: { name: input.name, code: input.code, annualBudget: input.annualBudget ?? null },
    });
  });
}

export async function savePolicy(
  user: SessionUser,
  input: z.infer<typeof policySchema> & { id?: string },
) {
  assertAdmin(user);
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Invalid policy.", "INVALID");
  const data = parsed.data;

  if (input.id) {
    const existing = await prisma.approvalWorkflow.findFirst({
      where: { id: input.id, orgId: user.orgId },
    });
    if (!existing) throw new ServiceError("Approval policy not found.", "NOT_FOUND");
    await prisma.$transaction(async (tx) => {
      await tx.approvalWorkflow.update({
        where: { id: input.id! },
        data: {
          name: data.name,
          minAmount: data.minAmount,
          maxAmount: data.maxAmount ?? null,
          levels: data.levels,
          secondLevelRole: data.levels >= 2 ? data.secondLevelRole : null,
          isActive: data.isActive,
        },
      });
      await recordAudit(tx, {
        orgId: user.orgId,
        actorId: user.id,
        entityType: "approval_workflow",
        entityId: input.id!,
        action: "update",
        before: { name: existing.name, min: toNumber(existing.minAmount), levels: existing.levels },
        after: { name: data.name, min: data.minAmount, levels: data.levels },
      });
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const policy = await tx.approvalWorkflow.create({
      data: {
        orgId: user.orgId,
        name: data.name,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount ?? null,
        levels: data.levels,
        secondLevelRole: data.levels >= 2 ? data.secondLevelRole : null,
        isActive: data.isActive,
      },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "approval_workflow",
      entityId: policy.id,
      action: "create",
      after: data,
    });
  });
}

export async function updateDefaultWeights(user: SessionUser, raw: unknown) {
  assertAdmin(user);
  const parsed = weightsSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Invalid weights.", "INVALID");
  await prisma.$transaction(async (tx) => {
    const organisation = await tx.organisation.update({
      where: { id: user.orgId },
      data: { defaultWeights: parsed.data },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "organisation",
      entityId: user.orgId,
      action: "update_default_weights",
      after: parsed.data,
    });
    void organisation;
  });
}

export async function listAuditLogs(
  user: SessionUser,
  filters: { q?: string; entityType?: string; page?: number } = {},
) {
  if (!can(user.role, "audit:read")) {
    throw new ServiceError("Only administrators can view audit logs.", "FORBIDDEN");
  }
  const page = Math.max(1, filters.page ?? 1);
  const perPage = 25;
  const where: Prisma.AuditLogWhereInput = {
    orgId: user.orgId,
    ...(filters.entityType && filters.entityType !== "ALL" ? { entityType: filters.entityType } : {}),
    ...(filters.q
      ? {
          OR: [
            { action: { contains: filters.q, mode: "insensitive" } },
            { entityType: { contains: filters.q, mode: "insensitive" } },
            { actor: { fullName: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { fullName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}
