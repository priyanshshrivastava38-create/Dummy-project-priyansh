export type Role = "ADMIN" | "PROCUREMENT_MANAGER" | "APPROVER";

export type Permission =
  | "request:create"
  | "request:read"
  | "request:update"
  | "request:delete"
  | "request:submit"
  | "request:cancel"
  | "vendor:read"
  | "vendor:write"
  | "quotation:read"
  | "quotation:write"
  | "quotation:extract"
  | "quotation:select"
  | "approval:read"
  | "approval:act"
  | "contract:read"
  | "contract:write"
  | "analytics:read"
  | "settings:manage"
  | "audit:read";

const APPROVER: Permission[] = [
  "request:create",
  "request:read",
  "request:update",
  "request:delete",
  "request:submit",
  "request:cancel",
  "vendor:read",
  "quotation:read",
  "approval:read",
  "approval:act",
  "contract:read",
  "analytics:read",
];

const PROCUREMENT_MANAGER: Permission[] = [
  "request:create",
  "request:read",
  "request:update",
  "request:delete",
  "request:submit",
  "request:cancel",
  "vendor:read",
  "vendor:write",
  "quotation:read",
  "quotation:write",
  "quotation:extract",
  "quotation:select",
  "approval:read",
  "contract:read",
  "contract:write",
  "analytics:read",
];

const ADMIN: Permission[] = Array.from(
  new Set<Permission>([
    ...PROCUREMENT_MANAGER,
    "approval:act",
    "settings:manage",
    "audit:read",
  ]),
);

const MATRIX: Record<Role, Permission[]> = {
  ADMIN,
  PROCUREMENT_MANAGER,
  APPROVER,
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

export function permissionsFor(role: Role) {
  return MATRIX[role];
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  PROCUREMENT_MANAGER: "Procurement Manager",
  APPROVER: "Department Manager",
};

/** Everyone sees their own work; managers and admins see the whole organisation. */
export function canSeeAllRequests(role: Role) {
  return role === "ADMIN" || role === "PROCUREMENT_MANAGER";
}

/** Segregation of duties: nobody approves their own purchase request. */
export function canDecideApproval(params: {
  role: Role;
  userId: string;
  requesterId: string;
  assignedApproverId: string;
  stepStatus: string;
}) {
  if (params.stepStatus !== "PENDING") return false;
  if (params.userId === params.requesterId) return false;
  if (params.userId === params.assignedApproverId) return true;
  return params.role === "ADMIN";
}
