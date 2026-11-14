import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type AuditInput = {
  orgId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordAudit(tx: Tx, input: AuditInput) {
  await tx.auditLog.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: json(input.before),
      after: json(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 250) ?? null,
    },
  });
}

type ActivityInput = {
  orgId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  requestId?: string | null;
  action: string;
  summary: string;
  metadata?: unknown;
};

export async function recordActivity(tx: Tx, input: ActivityInput) {
  await tx.activity.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.requestId ?? null,
      action: input.action,
      summary: input.summary,
      metadata: json(input.metadata),
    },
  });
}
