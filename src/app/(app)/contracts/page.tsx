import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  FileText,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getVendorOptionsForContracts, listContracts } from "@/lib/services/contracts";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContractStatusBadge } from "@/components/status-badge";
import { FilterBar } from "@/components/app/filter-bar";
import { ActiveFilters } from "@/components/app/active-filters";
import { TableRowLink } from "@/components/app/table-row-link";
import { ContractDialog } from "@/components/app/contract-dialog";

export const metadata = { title: "Contracts" };

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("contract:read");
  const params = await searchParams;
  const [{ items, summary }, vendors] = await Promise.all([
    listContracts(user, {
      q: params.q,
      status: params.status,
      window: params.window,
      vendorId: params.vendorId,
    }),
    getVendorOptionsForContracts(user),
  ]);

  const canWrite = can(user.role, "contract:write");
  const hasFilters = Boolean(params.q || params.status || params.vendorId || (params.window && params.window !== "all"));
  const riskItems = items.filter((contract) => contract.displayStatus === "EXPIRING" || contract.displayStatus === "EXPIRED");
  const activeVendor = vendors.find((vendor) => vendor.id === params.vendorId);
  const windowLabel =
    params.window === "expired"
      ? "Expired"
      : params.window && params.window !== "all"
        ? `Next ${params.window} days`
        : undefined;
  const contractStatusLabel = params.status
    ? params.status.charAt(0) + params.status.slice(1).toLowerCase()
    : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Module H"
        title="Contracts & renewals"
        description="Agreement value, term dates and renewal risk in one place. Status is derived from the dates, not typed in."
        actions={
          canWrite ? <ContractDialog vendors={vendors} currency={user.currency} /> : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active contracts"
          value={String(summary.active)}
          hint={`${items.length} in current view`}
          icon={ShieldCheck}
          tone="emerald"
        />
        <StatCard
          label="Expiring in 90 days"
          value={String(summary.expiringSoon)}
          hint={`${formatMoney(summary.renewalRiskValue, user.currency, { compact: true })} at risk`}
          icon={CalendarClock}
          tone="amber"
        />
        <StatCard
          label="Expired"
          value={String(summary.expired)}
          hint="Needs renewal or closure"
          icon={AlertTriangle}
          tone={summary.expired > 0 ? "sky" : "default"}
        />
        <StatCard
          label="Committed value"
          value={formatMoney(summary.totalValue, user.currency, { compact: summary.totalValue > 999_999 })}
          hint="Active and expiring contracts"
          icon={Wallet}
          tone="indigo"
        />
      </div>

      {riskItems.length > 0 ? (
        <Alert tone="warning" title={`${riskItems.length} contract${riskItems.length === 1 ? "" : "s"} need renewal attention`}>
          {riskItems.slice(0, 3).map((contract) => (
            <span key={contract.id}>
              {contract.title} ({contract.displayStatus === "EXPIRED" ? "expired" : `${contract.daysToRenewal}d to renewal`})
              {contract === riskItems[Math.min(2, riskItems.length - 1)] ? "." : " · "}
            </span>
          ))}{" "}
          Open a contract to renew it for 12 months or update the terms.
        </Alert>
      ) : null}

      <FilterBar
        searchPlaceholder="Search contract, vendor or category…"
        searchValue={params.q}
        selects={[
          {
            name: "window",
            label: "Renewal window",
            allLabel: "Any renewal date",
            allValue: "all",
            value: params.window,
            options: [
              { value: "30", label: "Next 30 days" },
              { value: "60", label: "Next 60 days" },
              { value: "90", label: "Next 90 days" },
              { value: "expired", label: "Expired" },
            ],
          },
          {
            name: "status",
            label: "Status",
            allLabel: "All statuses",
            value: params.status,
            options: ["ACTIVE", "EXPIRING", "EXPIRED", "RENEWED", "TERMINATED", "DRAFT"].map((status) => ({
              value: status,
              label: status.charAt(0) + status.slice(1).toLowerCase(),
            })),
          },
          {
            name: "vendorId",
            label: "Vendor",
            allLabel: "All vendors",
            value: params.vendorId,
            options: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
          },
        ]}
      >
        <div className="flex items-center gap-2 sm:ml-auto">
          {hasFilters ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contracts">Clear</Link>
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
        </div>
      </FilterBar>

      <ActiveFilters
        basePath="/contracts"
        params={params}
        filters={[
          { key: "q", label: "Search", value: params.q },
          { key: "window", label: "Renewal", value: params.window === "all" ? undefined : params.window, display: windowLabel },
          { key: "status", label: "Status", value: params.status, display: contractStatusLabel },
          { key: "vendorId", label: "Vendor", value: params.vendorId, display: activeVendor?.name },
        ]}
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={hasFilters ? "No contracts match those filters" : "No contracts yet"}
            description={
              hasFilters
                ? "Widen the renewal window or clear the vendor filter."
                : "Register agreements to track expiry risk and renewal obligations."
            }
            action={
              hasFilters ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/contracts">Clear filters</Link>
                </Button>
              ) : canWrite ? (
                <ContractDialog
                  vendors={vendors}
                  currency={user.currency}
                  trigger={<Button size="sm">Register contract</Button>}
                />
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Contract</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Term</TableHead>
                    <TableHead className="hidden md:table-cell">Renewal</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Days left</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((contract) => (
                    <TableRowLink
                      key={contract.id}
                      href={`/contracts/${contract.id}`}
                      label={`Open contract ${contract.title}`}
                    >
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium group-hover:text-indigo-700">{contract.title}</span>
                          {contract.documentName ? <FileText className="size-3.5 text-zinc-400" /> : null}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Owner {contract.owner.fullName}</span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/vendors/${contract.vendor.id}`} className="text-sm hover:text-indigo-700">
                          {contract.vendor.name}
                        </Link>
                        <span className="block text-[11px] text-muted-foreground">{contract.vendor.category}</span>
                      </TableCell>
                      <TableCell>
                        <ContractStatusBadge status={contract.displayStatus} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {formatDate(contract.renewalDate ?? contract.endDate)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular">
                        {formatMoney(contract.value, user.currency, { compact: Number(contract.value) > 999_999 })}
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {contract.displayStatus === "EXPIRED" ? (
                          <Badge variant="danger">Expired</Badge>
                        ) : contract.displayStatus === "TERMINATED" || contract.displayStatus === "RENEWED" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant={
                              (contract.daysToRenewal ?? 999) <= 30
                                ? "danger"
                                : (contract.daysToRenewal ?? 999) <= 90
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {contract.daysToRenewal}d
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <ArrowUpRight
                          className="ml-auto size-4 text-zinc-300 transition-colors group-hover:text-indigo-500"
                          aria-hidden
                        />
                      </TableCell>
                    </TableRowLink>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y md:hidden">
              {items.map((contract) => (
                <li key={contract.id}>
                  <Link
                    href={`/contracts/${contract.id}`}
                    className="block px-4 py-3.5 transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">{contract.title}</p>
                      <ContractStatusBadge status={contract.displayStatus} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {contract.vendor.name} · {contract.vendor.category}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Renews {formatDate(contract.renewalDate ?? contract.endDate)}
                      </span>
                      <span className="text-sm font-semibold tabular">
                        {formatMoney(contract.value, user.currency, { compact: Number(contract.value) > 999_999 })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
