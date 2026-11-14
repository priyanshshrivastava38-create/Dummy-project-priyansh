import type { ApprovalActionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can, canDecideApproval } from "@/lib/permissions";
import { recordActivity, recordAudit } from "./audit";
import { ServiceError } from "./errors";
import { requestScope } from "./requests";

const stepInclude = {
  request: {
    include: {
      department: { select: { id: true, name: true, code: true } },
      requester: { select: { id: true, fullName: true, email: true } },
    },
  },
  approver: { select: { id: true, fullName: true } },
} as const;

export type ApprovalAction = "APPROVE" | "REJECT" | "REQUEST_CLARIFICATION";

export async function getApprovalWorkspace(user: SessionUser) {
  const [assigned, decided, oversight] = await Promise.all([
    prisma.approvalStep.findMany({
      where: {
        status: "PENDING",
        request: { orgId: user.orgId },
        ...(user.role === "ADMIN" ? {} : { approverId: user.id }),
      },
      include: stepInclude,
      orderBy: [{ activatedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.approvalStep.findMany({
      where: {
        approverId: user.id,
        status: { in: ["APPROVED", "REJECTED", "CLARIFICATION_REQUESTED"] },
        request: { orgId: user.orgId },
      },
      include: stepInclude,
      orderBy: { decidedAt: "desc" },
      take: 25,
    }),
    user.role === "ADMIN" || user.role === "PROCUREMENT_MANAGER"
      ? prisma.approvalStep.findMany({
          where: { status: "PENDING", request: { orgId: user.orgId }, approverId: { not: user.id } },
          include: stepInclude,
          orderBy: { activatedAt: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  return { assigned, decided, oversight };
}

export async function getRequestApprovalContext(user: SessionUser, requestId: string) {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    include: {
      approvalSteps: {
        include: { approver: { select: { id: true, fullName: true, role: true, title: true } } },
        orderBy: { level: "asc" },
      },
      approvalActions: {
        include: { actor: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return request;
}

export async function decideApproval(
  user: SessionUser,
  stepId: string,
  action: ApprovalAction,
  comment: string,
) {
  if (!can(user.role, "approval:act")) {
    throw new ServiceError("You do not have permission to act on approvals.", "FORBIDDEN");
  }
  const trimmed = comment.trim();
  if ((action === "REJECT" || action === "REQUEST_CLARIFICATION") && trimmed.length < 5) {
    throw new ServiceError(
      action === "REJECT"
        ? "A rejection reason is required (at least 5 characters)."
        : "Explain what clarification you need (at least 5 characters).",
      "INVALID",
    );
  }

  const step = await prisma.approvalStep.findUnique({
    where: { id: stepId },
    include: {
      request: {
        include: {
          approvalSteps: { orderBy: { level: "asc" } },
          requester: { select: { id: true, fullName: true } },
        },
      },
      approver: { select: { id: true, fullName: true } },
    },
  });
  if (!step || step.request.orgId !== user.orgId) {
    throw new ServiceError("Approval step not found.", "NOT_FOUND");
  }
  if (
    !canDecideApproval({
      role: user.role,
      userId: user.id,
      requesterId: step.request.requesterId,
      assignedApproverId: step.approverId,
      stepStatus: step.status,
    })
  ) {
    if (step.status !== "PENDING") {
      throw new ServiceError("This approval step has already been decided.", "CONFLICT");
    }
    if (step.request.requesterId === user.id) {
      throw new ServiceError("Segregation of duties: you cannot approve your own request.", "FORBIDDEN");
    }
    throw new ServiceError("This approval is assigned to another approver.", "FORBIDDEN");
  }

  const request = step.request;
  const actionType: ApprovalActionType =
    action === "APPROVE" ? "APPROVE" : action === "REJECT" ? "REJECT" : "REQUEST_CLARIFICATION";

  await prisma.$transaction(async (tx) => {
    if (action === "APPROVE") {
      const next = request.approvalSteps.find((s) => s.level > step.level && s.status === "WAITING");
      await tx.approvalStep.update({
        where: { id: step.id },
        data: { status: "APPROVED", decidedAt: new Date() },
      });

      if (next) {
        await tx.approvalStep.update({
          where: { id: next.id },
          data: { status: "PENDING", activatedAt: new Date() },
        });
        await tx.purchaseRequest.update({ where: { id: request.id }, data: { status: "UNDER_REVIEW" } });
      } else {
        await tx.purchaseRequest.update({
          where: { id: request.id },
          data: { status: "APPROVED", approvedAt: new Date(), rejectionReason: null },
        });
      }
    } else if (action === "REJECT") {
      await tx.approvalStep.update({
        where: { id: step.id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      await tx.approvalStep.updateMany({
        where: { requestId: request.id, id: { not: step.id }, status: { in: ["PENDING", "WAITING"] } },
        data: { status: "SKIPPED" },
      });
      await tx.purchaseRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED", rejectionReason: trimmed },
      });
    } else {
      await tx.approvalStep.update({
        where: { id: step.id },
        data: { status: "CLARIFICATION_REQUESTED" },
      });
      await tx.purchaseRequest.update({ where: { id: request.id }, data: { status: "UNDER_REVIEW" } });
    }

    await tx.approvalAction.create({
      data: {
        requestId: request.id,
        stepId: step.id,
        actorId: user.id,
        action: actionType,
        comment: trimmed || null,
      },
    });

    const summary =
      action === "APPROVE"
        ? request.approvalSteps.some((s) => s.level > step.level && s.status === "WAITING")
          ? `Approved level ${step.level} of ${request.reference}; escalated to the next approver`
          : `Approved ${request.reference} at level ${step.level}`
        : action === "REJECT"
          ? `Rejected ${request.reference}: ${trimmed}`
          : `Requested clarification on ${request.reference}: ${trimmed}`;

    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: request.id,
      requestId: request.id,
      action: action.toLowerCase(),
      summary,
      metadata: { level: step.level, comment: trimmed || null },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "approval_step",
      entityId: step.id,
      action: actionType.toLowerCase(),
      before: { stepStatus: step.status, requestStatus: request.status },
      after: { decision: action, comment: trimmed || null },
    });
  });

  return { status: action };
}

export async function addRequestComment(user: SessionUser, requestId: string, comment: string) {
  const trimmed = comment.trim();
  if (trimmed.length < 2) throw new ServiceError("Write a comment first.", "INVALID");

  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, ...requestScope(user) },
    select: { id: true, reference: true, status: true, requesterId: true },
  });
  if (!request) throw new ServiceError("Purchase request not found.", "NOT_FOUND");

  const isParticipant =
    request.requesterId === user.id ||
    user.role === "ADMIN" ||
    user.role === "PROCUREMENT_MANAGER" ||
    (await prisma.approvalStep.findFirst({
      where: { requestId, approverId: user.id },
      select: { id: true },
    })) !== null;
  if (!isParticipant) {
    throw new ServiceError("Only request participants can comment.", "FORBIDDEN");
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalAction.create({
      data: { requestId, actorId: user.id, action: "COMMENT", comment: trimmed },
    });
    if (request.status === "SUBMITTED" && user.role !== "APPROVER") {
      await tx.purchaseRequest.update({ where: { id: requestId }, data: { status: "UNDER_REVIEW" } });
    }
    await recordActivity(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      requestId,
      action: "commented",
      summary: `Commented on ${request.reference}`,
      metadata: { comment: trimmed },
    });
    await recordAudit(tx, {
      orgId: user.orgId,
      actorId: user.id,
      entityType: "purchase_request",
      entityId: requestId,
      action: "comment",
      after: { comment: trimmed },
    });
  });
}

export async function getApprovalPolicies(orgId: string) {
  return prisma.approvalWorkflow.findMany({ where: { orgId }, orderBy: { minAmount: "asc" } });
}
