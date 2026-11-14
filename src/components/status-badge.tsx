import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const requestTones: Record<string, "neutral" | "info" | "warning" | "success" | "danger" | "violet"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SOURCING: "violet",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export function RequestStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={requestTones[status] ?? "neutral"}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {titleCase(status)}
    </Badge>
  );
}

const priorityTones: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge variant={priorityTones[priority] ?? "neutral"}>{titleCase(priority)}</Badge>;
}

const quotationTones: Record<string, "neutral" | "info" | "success" | "violet" | "warning"> = {
  RECEIVED: "neutral",
  UNDER_REVIEW: "info",
  SHORTLISTED: "violet",
  SELECTED: "success",
  NOT_SELECTED: "neutral",
};

export function QuotationStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={quotationTones[status] ?? "neutral"}>
      {status === "SELECTED" ? "Selected" : status === "NOT_SELECTED" ? "Not selected" : titleCase(status)}
    </Badge>
  );
}

const contractTones: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  ACTIVE: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
  RENEWED: "info",
  TERMINATED: "neutral",
  DRAFT: "neutral",
};

export function ContractStatusBadge({ status }: { status: string }) {
  return <Badge variant={contractTones[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

const complianceTones: Record<string, "success" | "warning" | "danger"> = {
  COMPLIANT: "success",
  PENDING: "warning",
  NON_COMPLIANT: "danger",
};

export function ComplianceBadge({ status }: { status: string }) {
  return (
    <Badge variant={complianceTones[status] ?? "neutral"}>
      {status === "NON_COMPLIANT" ? "Non-compliant" : titleCase(status)}
    </Badge>
  );
}

const extractionTones: Record<string, "neutral" | "info" | "success" | "danger" | "warning"> = {
  PENDING: "neutral",
  PROCESSING: "info",
  EXTRACTED: "success",
  FAILED: "danger",
  MANUAL: "neutral",
};

export function ExtractionStatusBadge({ status }: { status: string }) {
  return <Badge variant={extractionTones[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const label = role === "ADMIN" ? "Administrator" : role === "PROCUREMENT_MANAGER" ? "Procurement" : "Approver";
  return <Badge variant={role === "ADMIN" ? "violet" : role === "PROCUREMENT_MANAGER" ? "info" : "secondary"}>{label}</Badge>;
}
