import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { listAuditLogs } from "@/lib/services/settings";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterBar } from "@/components/app/filter-bar";
import { ActiveFilters } from "@/components/app/active-filters";
import { Pagination } from "@/components/app/pagination";

export const metadata = { title: "Audit log" };

const ENTITY_TYPES = [
  "purchase_request",
  "purchase_request_document",
  "approval_step",
  "quotation",
  "quotation_document",
  "vendor",
  "contract",
  "profile",
  "department",
  "approval_workflow",
  "organisation",
];

const ENTITY_LABELS: Record<string, string> = {
  purchase_request: "Purchase request",
  purchase_request_document: "Request document",
  approval_step: "Approval step",
  quotation: "Quotation",
  quotation_document: "Quotation document",
  vendor: "Vendor",
  contract: "Contract",
  profile: "User",
  department: "Department",
  approval_workflow: "Approval policy",
  organisation: "Organisation",
};

type Tone = "neutral" | "success" | "danger" | "info" | "warning";

function actionTone(action: string): Tone {
  if (/(reject|cancel|delete|terminate|deactivate|remove)/.test(action)) return "danger";
  if (/(approve|renew|select|create_user)/.test(action)) return "success";
  if (/(clarification)/.test(action)) return "warning";
  if (/(update|attach|extract|comment|submit|renew)/.test(action)) return "info";
  return "neutral";
}

function entityHref(entityType: string, entityId: string) {
  if (entityType === "purchase_request") return `/requests/${entityId}`;
  if (entityType === "vendor") return `/vendors/${entityId}`;
  if (entityType === "contract") return `/contracts/${entityId}`;
  return null;
}

function Snapshot({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-relaxed scrollbar-thin">
        {value === null || value === undefined ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("audit:read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() || undefined;
  const entityType = params.entityType && params.entityType !== "ALL" ? params.entityType : undefined;
  const data = await listAuditLogs(user, { q, entityType, page });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        description="Every consequential action is recorded with actor, entity, before and after values. Entries cannot be edited from the application."
      />

      <FilterBar
        searchPlaceholder="Search action, entity or actor…"
        searchValue={q}
        selects={[
          {
            name: "entityType",
            label: "entities",
            value: entityType,
            options: ENTITY_TYPES.map((type) => ({ value: type, label: ENTITY_LABELS[type] ?? type })),
          },
        ]}
      >
        <p className="text-[11px] text-muted-foreground sm:ml-auto">{data.total} entries recorded</p>
      </FilterBar>

      <ActiveFilters
        basePath="/audit"
        params={params}
        filters={[
          { key: "q", label: "Search", value: q },
          {
            key: "entityType",
            label: "Entity",
            value: entityType,
            display: entityType ? (ENTITY_LABELS[entityType] ?? entityType) : undefined,
          },
        ]}
      />

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Activity ledger</CardTitle>
            <CardDescription>
              Newest first. {q || entityType ? "Filtered view — " : ""}entries are append-only: the application exposes
              no edit or delete path, and every row keeps its before/after snapshot.
            </CardDescription>
          </div>
          <Badge variant="neutral" className="font-mono text-[10px]">
            ADMIN · audit:read
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          {data.items.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No matching audit entries"
              description={
                q || entityType
                  ? "Clear the filters to see the full trail, or try a different search."
                  : "Actions appear here as soon as users change requests, quotations, contracts or settings."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="pr-5">Snapshot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((entry) => {
                  const href = entityHref(entry.entityType, entry.entityId);
                  return (
                    <TableRow key={entry.id} className="align-top">
                      <TableCell className="whitespace-nowrap pl-5 text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        {entry.actor ? (
                          <div className="min-w-[120px]">
                            <p className="text-sm font-medium">{entry.actor.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {ROLE_LABELS[entry.actor.role as Role]}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionTone(entry.action)} className="font-mono text-[10px]">
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{ENTITY_LABELS[entry.entityType] ?? entry.entityType}</p>
                        {href ? (
                          <Link
                            href={href}
                            className="font-mono text-[10px] text-indigo-600 hover:underline"
                          >
                            {entry.entityId.slice(0, 10)}…
                          </Link>
                        ) : (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {entry.entityId.slice(0, 10)}…
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        {entry.before === null && entry.after === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <details className="group min-w-[180px]">
                            <summary className="cursor-pointer list-none text-xs font-medium text-indigo-600 hover:underline">
                              Inspect
                            </summary>
                            <div className="mt-2 grid gap-2 rounded-lg border bg-background p-2 md:min-w-[420px] md:grid-cols-2">
                              <Snapshot label="Before" value={entry.before} />
                              <Snapshot label="After" value={entry.after} />
                            </div>
                          </details>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="px-5">
            <Pagination
              basePath="/audit"
              page={data.page}
              pages={data.pages}
              total={data.total}
              params={{ q, entityType }}
              noun="entries"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
