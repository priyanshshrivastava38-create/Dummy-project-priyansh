import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApprovalPlanError,
  buildApprovalPlan,
  selectPolicy,
  type PolicyInput,
} from "../src/lib/approvals/plan";

const policy = (overrides: Partial<PolicyInput>): PolicyInput => ({
  id: "p",
  name: "Policy",
  minAmount: 0,
  maxAmount: null,
  levels: 1,
  secondLevelRole: "ADMIN",
  isActive: true,
  ...overrides,
});

const policies: PolicyInput[] = [
  policy({ id: "low", name: "Low value", minAmount: 0, maxAmount: 5_000, levels: 1 }),
  policy({ id: "mid", name: "Mid value", minAmount: 5_000, maxAmount: 50_000, levels: 2, secondLevelRole: "ADMIN" }),
  policy({ id: "high", name: "High value", minAmount: 50_000, maxAmount: null, levels: 2, secondLevelRole: "PROCUREMENT_MANAGER" }),
  policy({ id: "inactive", name: "Retired", minAmount: 0, maxAmount: 100_000, levels: 3, isActive: false }),
];

test("selectPolicy matches the correct spend band and ignores inactive policies", () => {
  assert.equal(selectPolicy(policies, 1_200)?.id, "low");
  assert.equal(selectPolicy(policies, 4_999)?.id, "low");
  // Bands are inclusive at both ends; the higher matching band wins at a boundary.
  assert.equal(selectPolicy(policies, 5_000)?.id, "mid");
  assert.equal(selectPolicy(policies, 20_000)?.id, "mid");
  assert.equal(selectPolicy(policies, 90_000)?.id, "high");
});

test("selectPolicy handles amounts outside every band", () => {
  const banded = [policy({ id: "a", minAmount: 1_000, maxAmount: 10_000 }), policy({ id: "b", minAmount: 10_001, maxAmount: 20_000 })];
  assert.equal(selectPolicy(banded, 100)?.id, "a");
  assert.equal(selectPolicy(banded, 99_000)?.id, "b");
  assert.equal(selectPolicy([], 500), null);
});

test("a one-level policy plans just the department manager", () => {
  const plan = buildApprovalPlan({
    amount: 2_000,
    requesterId: "u-requester",
    policies,
    candidates: {
      departmentApproverIds: ["u-dept"],
      adminIds: ["u-admin"],
      procurementManagerIds: ["u-proc"],
    },
  });
  assert.equal(plan.policy?.id, "low");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].approverId, "u-dept");
  assert.equal(plan.steps[0].roleLabel, "Department Manager");
});

test("two-level policies escalate to the configured second-level role", () => {
  const adminPlan = buildApprovalPlan({
    amount: 20_000,
    requesterId: "u-requester",
    policies,
    candidates: {
      departmentApproverIds: ["u-dept"],
      adminIds: ["u-admin"],
      procurementManagerIds: ["u-proc"],
    },
  });
  assert.deepEqual(
    adminPlan.steps.map((s) => [s.level, s.approverId, s.roleLabel]),
    [
      [1, "u-dept", "Department Manager"],
      [2, "u-admin", "Administrator"],
    ],
  );

  const procurementPlan = buildApprovalPlan({
    amount: 90_000,
    requesterId: "u-requester",
    policies,
    candidates: {
      departmentApproverIds: ["u-dept"],
      adminIds: ["u-admin"],
      procurementManagerIds: ["u-proc"],
    },
  });
  assert.equal(procurementPlan.steps[1].approverId, "u-proc");
  assert.equal(procurementPlan.steps[1].roleLabel, "Procurement Manager");
});

test("segregation of duties escalates away from the requester", () => {
  const plan = buildApprovalPlan({
    amount: 2_000,
    requesterId: "u-dept",
    policies,
    candidates: {
      departmentApproverIds: ["u-dept"],
      adminIds: ["u-admin"],
      procurementManagerIds: ["u-proc"],
    },
  });
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].approverId, "u-admin");
  assert.equal(plan.steps[0].roleLabel, "Administrator");
});

test("second level falls back to an administrator when procurement has no eligible manager", () => {
  const plan = buildApprovalPlan({
    amount: 90_000,
    requesterId: "u-dept",
    policies,
    candidates: {
      departmentApproverIds: ["u-dept"],
      adminIds: ["u-admin", "u-admin-2"],
      procurementManagerIds: ["u-dept"],
    },
  });
  // The requester is the only procurement manager, so level 1 escalates to
  // an admin and level 2 must use a different admin.
  assert.equal(plan.steps[0].approverId, "u-admin");
  assert.equal(plan.steps[0].roleLabel, "Administrator");
  assert.equal(plan.steps[1].approverId, "u-admin-2");
  assert.equal(plan.steps[1].roleLabel, "Administrator");
});

test("planning fails loudly when no eligible approver exists", () => {
  assert.throws(
    () =>
      buildApprovalPlan({
        amount: 2_000,
        requesterId: "u-only",
        policies,
        candidates: {
          departmentApproverIds: ["u-only"],
          adminIds: [],
          procurementManagerIds: ["u-only"],
        },
      }),
    (error: unknown) => error instanceof ApprovalPlanError && /No eligible approver/.test(error.message),
  );
});
