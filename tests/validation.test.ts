import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contractSchema,
  departmentSchema,
  policySchema,
  requestSchema,
  userAdminSchema,
  weightsSchema,
} from "../src/lib/validation/schemas";

const requestPayload = {
  title: "Replace meeting-room displays",
  description: "Two displays failed this quarter and block client presentations.",
  category: "IT Hardware",
  departmentId: "dept-1",
  priority: "HIGH",
  estimatedBudget: 8_000,
  requiredBy: "2026-12-01",
  items: [{ description: "55-inch display", quantity: 2, unit: "unit", estimatedUnitPrice: 3_500 }],
};

test("requestSchema requires at least one line item", () => {
  assert.equal(requestSchema.safeParse(requestPayload).success, true);
  assert.equal(requestSchema.safeParse({ ...requestPayload, items: [] }).success, false);
  assert.equal(requestSchema.safeParse({ ...requestPayload, title: "hi" }).success, false);
});

test("requestSchema turns date-only input into a stable UTC date", () => {
  const parsed = requestSchema.parse(requestPayload);
  assert.equal(parsed.requiredBy?.toISOString(), "2026-12-01T12:00:00.000Z");
  assert.equal(parsed.items[0].quantity, 2);
});

test("weights must total exactly 100", () => {
  assert.equal(weightsSchema.safeParse({ price: 35, delivery: 20, quality: 20, reliability: 15, payment: 10 }).success, true);
  assert.equal(weightsSchema.safeParse({ price: 35, delivery: 20, quality: 20, reliability: 15, payment: 5 }).success, false);
});

test("contractSchema enforces chronological dates", () => {
  const valid = {
    title: "Managed print services",
    vendorId: "vendor-1",
    value: 24_000,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    renewalDate: "2026-11-30",
    status: "ACTIVE",
  };
  const parsed = contractSchema.parse(valid);
  assert.equal(parsed.startDate.toISOString(), "2026-01-01T12:00:00.000Z");

  const backwards = contractSchema.safeParse({ ...valid, endDate: "2025-12-31" });
  assert.equal(backwards.success, false);

  const renewalBeforeStart = contractSchema.safeParse({ ...valid, renewalDate: "2025-06-01" });
  assert.equal(renewalBeforeStart.success, false);
});

test("policySchema rejects inverted spend bands", () => {
  const base = { name: "Mid value", minAmount: 5_000, levels: 2, secondLevelRole: "ADMIN", isActive: true };
  assert.equal(policySchema.safeParse({ ...base, maxAmount: 50_000 }).success, true);
  assert.equal(policySchema.safeParse({ ...base, maxAmount: 1_000 }).success, false);
  assert.equal(policySchema.safeParse({ ...base, levels: 4 }).success, false);
});

test("department codes are normalised and constrained", () => {
  const parsed = departmentSchema.parse({ name: "Engineering", code: "eng", annualBudget: 250_000 });
  assert.equal(parsed.code, "ENG");
  assert.equal(departmentSchema.safeParse({ name: "Engineering", code: "E N G" }).success, false);
});

test("userAdminSchema allows an optional password but not a short one", () => {
  const base = { fullName: "Amara Okafor", email: "amara@example.com", role: "APPROVER", departmentId: "dept-1", isActive: true };
  assert.equal(userAdminSchema.safeParse(base).success, true);
  assert.equal(userAdminSchema.safeParse({ ...base, password: "" }).success, true);
  assert.equal(userAdminSchema.safeParse({ ...base, password: "short" }).success, false);
  assert.equal(userAdminSchema.safeParse({ ...base, role: "OWNER" }).success, false);
});
