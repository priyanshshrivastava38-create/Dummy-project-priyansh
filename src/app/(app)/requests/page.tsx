import Link from "next/link";
import { ArrowUpRight, FilePlus2, FileText, SlidersHorizontal } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listPurchaseRequests, getRequestFormOptions } from "@/lib/services/requests";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { TableRowLink } from "@/components/app/table-row-link";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";

export const metadata = { title: "Purchase requests" };

const STATUS_OPTIONS = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "SOURCING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;

  const [{ items, total, pages }, options] = await Promise.all([
    listPurchaseRequests(user, {
      q: params.q,
      status: params.status,
      departmentId: params.departmentId,
      priority: params.priority,
      sort: params.sort,
      page,
    }),
    getRequestFormOptions(user),
  ]);

  const activeFilters = [params.q, params.status, params.departmentId, params.priority].filter(Boolean).length;
  const canCreate = can(user.role, "request:create");
  const activeDepartment = options.departments.find((dept) => dept.id === params.departmentId);
  const statusLabel = params.status
    ? params.status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
    : undefined;
  const priorityLabel = params.priority
    ? params.priority.charAt(0) + params.priority.slice(1).toLowerCase()
    : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Module B"
        title="Purchase requests"
        description="Every request from draft to completion, with budgets, approvals and linked sourcing decisions."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/requests/new">
                <FilePlus2 className="size-4" /> New request
              </Link>
            </Button>
          ) : null
        }
      />

      <FilterBar
        searchPlaceholder="Search title, reference or description…"
        searchValue={params.q}
        selects={[
          {
            name: "status",
            label: "Status",
            allLabel: "All statuses",
            value: params.status,
            options: STATUS_OPTIONS.map((status) => ({
              value: status,
              label: status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
            })),
          },
          {
            name: "departmentId",
            label: "Department",
            allLabel: "All departments",
            value: params.departmentId,
            options: options.departments.map((dept) => ({ value: dept.id, label: dept.name })),
          },
          {
            name: "priority",
            label: "Priority",
            allLabel: "All priorities",
            value: params.priority,
            options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => ({
              value: priority,
              label: priority.charAt(0) + priority.slice(1).toLowerCase(),
            })),
          },
          {
            name: "sort",
            label: "Sort",
            allLabel: "Newest first",
            allValue: "newest",
            value: params.sort,
            options: [
              { value: "oldest", label: "Oldest first" },
              { value: "budget", label: "Highest budget" },
              { value: "title", label: "Title A–Z" },
            ],
          },
        ]}
      >
        <div className="flex items-center gap-2 sm:ml-auto">
          {activeFilters > 0 ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/requests">Clear filters</Link>
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="outline">
            <SlidersHorizontal className="size-4" /> Apply
          </Button>
        </div>
      </FilterBar>

      <ActiveFilters
        basePath="/requests"
        params={params}
        filters={[
          { key: "q", label: "Search", value: params.q },
          { key: "status", label: "Status", value: params.status, display: statusLabel },
          {
            key: "departmentId",
            label: "Department",
            value: params.departmentId,
            display: activeDepartment?.name,
          },
          { key: "priority", label: "Priority", value: params.priority, display: priorityLabel },
        ]}
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={activeFilters > 0 ? "No requests match those filters" : "No purchase requests yet"}
            description={
              activeFilters > 0
                ? "Try widening the status, department or search term."
                : "Raise your first request to start a documented approval and sourcing trail."
            }
            action={
              activeFilters > 0 ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/requests">Clear filters</Link>
                </Button>
              ) : canCreate ? (
                <Button size="sm" asChild>
                  <Link href="/requests/new">Create a request</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Request</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden lg:table-cell">Requester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="hidden xl:table-cell">Created</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((request) => (
                  <TableRowLink
                    key={request.id}
                    href={`/requests/${request.id}`}
                    label={`Open ${request.reference} — ${request.title}`}
                  >
                    <TableCell className="max-w-[320px]">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{request.reference}</span>
                        {request._count.quotations > 0 ? (
                          <Badge variant="neutral">{request._count.quotations} quotes</Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium group-hover:text-indigo-700">
                        {request.title}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm">{request.department.name}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                        {request.department.code}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {request.requester.fullName}
                    </TableCell>
                    <TableCell>
                      <RequestStatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <PriorityBadge priority={request.priority} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular">
                      {formatMoney(request.estimatedBudget, user.currency)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                      {formatDate(request.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/requests/${request.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Open
                        <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRowLink>
                ))}
              </TableBody>
            </Table>
            </div>

            <ul className="divide-y md:hidden">
              {items.map((request) => (
                <li key={request.id}>
                  <Link
                    href={`/requests/${request.id}`}
                    className="block px-4 py-3.5 transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{request.reference}</span>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug">{request.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {request.department.name} · {request.requester.fullName}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular">
                        {formatMoney(request.estimatedBudget, user.currency)}
                      </span>
                      <span className="flex items-center gap-2">
                        <PriorityBadge priority={request.priority} />
                        {request._count.quotations > 0 ? (
                          <Badge variant="neutral">{request._count.quotations} quotes</Badge>
                        ) : null}
                        <ArrowUpRight className="size-3.5 text-zinc-300" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-t px-4 py-3">
              <Pagination
                basePath="/requests"
                page={page}
                pages={pages}
                total={total}
                params={{
                  q: params.q,
                  status: params.status,
                  departmentId: params.departmentId,
                  priority: params.priority,
                  sort: params.sort,
                }}
                noun="requests"
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
