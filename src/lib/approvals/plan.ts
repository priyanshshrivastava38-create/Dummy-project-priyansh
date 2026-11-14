/**
 * Pure approval-chain resolution. The database service passes candidates in;
 * this module decides who must sign off for a given amount.
 */

export type PolicyInput = {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  levels: number;
  secondLevelRole: "ADMIN" | "PROCUREMENT_MANAGER";
  isActive: boolean;
};

export type ApprovalCandidates = {
  departmentApproverIds: string[];
  adminIds: string[];
  procurementManagerIds: string[];
};

export type PlannedStep = {
  level: number;
  approverId: string;
  roleLabel: string;
  policyName: string;
};

export type ApprovalPlan = {
  policy: PolicyInput | null;
  steps: PlannedStep[];
};

export class ApprovalPlanError extends Error {}

export function selectPolicy(policies: PolicyInput[], amount: number): PolicyInput | null {
  const active = policies.filter((p) => p.isActive).sort((a, b) => a.minAmount - b.minAmount);
  const matching = active.filter(
    (p) => amount >= p.minAmount && (p.maxAmount === null || amount <= p.maxAmount),
  );
  if (matching.length) return matching[matching.length - 1];

  // Amount below every band: the lowest band still governs. Above a finite
  // top band with no catch-all, the highest band governs.
  if (!active.length) return null;
  return amount < active[0].minAmount ? active[0] : active[active.length - 1];
}

export function buildApprovalPlan(input: {
  amount: number;
  requesterId: string;
  policies: PolicyInput[];
  candidates: ApprovalCandidates;
}): ApprovalPlan {
  const { amount, requesterId, policies, candidates } = input;
  const policy = selectPolicy(policies, amount);

  // Never fall back to the requester: if they are the only department
  // approver, escalate to an administrator or procurement manager instead.
  const departmentFirst = candidates.departmentApproverIds.find((id) => id !== requesterId);
  const adminFirst = candidates.adminIds.find((id) => id !== requesterId);
  const procurementFirst = candidates.procurementManagerIds.find((id) => id !== requesterId);
  const first = departmentFirst ?? adminFirst ?? procurementFirst;

  if (!first) {
    throw new ApprovalPlanError(
      "No eligible approver is configured for this request. Ask an administrator to assign a department manager.",
    );
  }

  const steps: PlannedStep[] = [
    {
      level: 1,
      approverId: first,
      roleLabel: departmentFirst ? "Department Manager" : adminFirst ? "Administrator" : "Procurement Manager",
      policyName: policy?.name ?? "Standard approval",
    },
  ];

  const needsSecond = (policy?.levels ?? 1) >= 2;
  if (needsSecond) {
    const role = policy?.secondLevelRole ?? "ADMIN";
    const pool = role === "ADMIN" ? candidates.adminIds : candidates.procurementManagerIds;
    const eligible = (id: string) => id !== requesterId && id !== first;

    let second = pool.find(eligible);
    let secondLabel = role === "ADMIN" ? "Administrator" : "Procurement Manager";

    if (!second && role !== "ADMIN") {
      second = candidates.adminIds.find(eligible);
      if (second) secondLabel = "Administrator";
    }

    if (!second) {
      throw new ApprovalPlanError(
        `This request needs a second-level ${role === "ADMIN" ? "administrator" : "procurement manager"} approval, but none is configured.`,
      );
    }

    steps.push({
      level: 2,
      approverId: second,
      roleLabel: secondLabel,
      policyName: policy?.name ?? "Elevated approval",
    });
  }

  return { policy, steps };
}
