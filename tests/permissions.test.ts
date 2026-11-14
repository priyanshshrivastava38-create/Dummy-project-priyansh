import { test } from "node:test";
import assert from "node:assert/strict";
import {
  can,
  canDecideApproval,
  canSeeAllRequests,
  permissionsFor,
  type Permission,
  type Role,
} from "../src/lib/permissions";

const expectPermission = (role: Role, permission: Permission, allowed: boolean) => {
  assert.equal(can(role, permission), allowed, `${role} ${allowed ? "should" : "should not"} have ${permission}`);
};

test("role matrix grants exactly the intended permissions", () => {
  const cases: [Role, Permission, boolean][] = [
    ["ADMIN", "settings:manage", true],
    ["ADMIN", "audit:read", true],
    ["ADMIN", "contract:write", true],
    ["PROCUREMENT_MANAGER", "settings:manage", false],
    ["PROCUREMENT_MANAGER", "audit:read", false],
    ["PROCUREMENT_MANAGER", "quotation:extract", true],
    ["PROCUREMENT_MANAGER", "contract:write", true],
    ["APPROVER", "vendor:write", false],
    ["APPROVER", "quotation:write", false],
    ["APPROVER", "contract:write", false],
    ["APPROVER", "approval:act", true],
    ["APPROVER", "analytics:read", true],
    ["APPROVER", "request:create", true],
  ];
  for (const [role, permission, allowed] of cases) expectPermission(role, permission, allowed);
});

test("permission lists have no duplicates and include read access for every role", () => {
  for (const role of ["ADMIN", "PROCUREMENT_MANAGER", "APPROVER"] as Role[]) {
    const list = permissionsFor(role);
    assert.equal(new Set(list).size, list.length, `${role} has duplicate permissions`);
    assert.ok(list.includes("request:read"));
    assert.ok(list.includes("vendor:read"));
    assert.ok(list.includes("approval:read"));
  }
});

test("only admins and procurement managers see the whole request ledger", () => {
  assert.equal(canSeeAllRequests("ADMIN"), true);
  assert.equal(canSeeAllRequests("PROCUREMENT_MANAGER"), true);
  assert.equal(canSeeAllRequests("APPROVER"), false);
});

test("approval decisions enforce assignment and segregation of duties", () => {
  const base = {
    role: "APPROVER" as Role,
    userId: "u-approver",
    requesterId: "u-requester",
    assignedApproverId: "u-approver",
    stepStatus: "PENDING",
  };

  assert.equal(canDecideApproval(base), true);
  assert.equal(canDecideApproval({ ...base, userId: "u-requester", assignedApproverId: "u-requester" }), false);
  assert.equal(canDecideApproval({ ...base, userId: "u-other" }), false);
  assert.equal(canDecideApproval({ ...base, stepStatus: "APPROVED" }), false);

  // Admins can cover an assigned approver, but still cannot approve their own request.
  assert.equal(canDecideApproval({ ...base, role: "ADMIN", userId: "u-admin" }), true);
  assert.equal(canDecideApproval({ ...base, role: "ADMIN", userId: "u-requester" }), false);
});
