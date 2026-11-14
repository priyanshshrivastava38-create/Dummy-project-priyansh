import Link from "next/link";
import { ArrowUpRight, Building2, Filter, ShieldAlert, Star, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listVendors } from "@/lib/services/vendors";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComplianceBadge } from "@/components/status-badge";
import { FilterBar } from "@/components/app/filter-bar";
import { ActiveFilters } from "@/components/app/active-filters";
import { TableRowLink } from "@/components/app/table-row-link";
import { VendorFormDialog } from "@/components/app/vendor-dialogs";

export const metadata = { title: "Vendors" };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { rows, categories, total } = await listVendors(user, {
    q: params.q,
    category: params.category,
    status: params.status,
    compliance: params.compliance,
    sort: params.sort,
  });

  const canWrite = can(user.role, "vendor:write");
  const active = rows.filter((vendor) => vendor.status === "ACTIVE").length;
  const awardedValue = rows.reduce((sum, vendor) => sum + vendor.awardedValue, 0);
  const rated = rows.filter((vendor) => vendor.performanceRating !== null);
  const avgRating = rated.length
    ? Math.round(rated.reduce((sum, vendor) => sum + (vendor.performanceRating ?? 0), 0) / rated.length)
    : null;
  const attention = rows.filter((vendor) => vendor.complianceStatus !== "COMPLIANT").length;
  const hasFilters = Boolean(params.q || params.category || params.status || params.compliance);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Module C"
        title="Vendor directory"
        description="Contacts, compliance, delivery reliability and awarded spend — the inputs quotation scoring depends on."
        actions={canWrite ? <VendorFormDialog /> : null}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active vendors"
          value={String(active)}
          hint={`${total} total in directory`}
          icon={Building2}
          tone="indigo"
        />
        <StatCard
          label="Awarded spend"
          value={formatMoney(awardedValue, user.currency, { compact: awardedValue > 999_999 })}
          hint="Selected quotations only"
          icon={Wallet}
          tone="emerald"
        />
        <StatCard
          label="Average rating"
          value={avgRating === null ? "—" : `${avgRating}/100`}
          hint={rated.length ? `${rated.length} vendors rated` : "No evaluations recorded"}
          icon={Star}
          tone="amber"
        />
        <StatCard
          label="Compliance attention"
          value={String(attention)}
          hint="Pending or non-compliant"
          icon={ShieldAlert}
          tone={attention > 0 ? "sky" : "default"}
        />
      </div>

      <FilterBar
        searchPlaceholder="Search vendor, contact, email or category…"
        searchValue={params.q}
        selects={[
          {
            name: "category",
            label: "Category",
            allLabel: "All categories",
            value: params.category,
            options: categories.map((category) => ({ value: category, label: category })),
          },
          {
            name: "status",
            label: "Status",
            allLabel: "All statuses",
            value: params.status,
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
          {
            name: "compliance",
            label: "Compliance",
            allLabel: "All compliance",
            value: params.compliance,
            options: [
              { value: "COMPLIANT", label: "Compliant" },
              { value: "PENDING", label: "Pending" },
              { value: "NON_COMPLIANT", label: "Non-compliant" },
            ],
          },
          {
            name: "sort",
            label: "Sort",
            allLabel: "Name A–Z",
            allValue: "name",
            value: params.sort,
            options: [
              { value: "spend", label: "Highest awarded spend" },
              { value: "rating", label: "Best rating" },
              { value: "delivery", label: "Best delivery" },
              { value: "oldest", label: "Oldest first" },
            ],
          },
        ]}
      >
        <div className="flex items-center gap-2 sm:ml-auto">
          {hasFilters ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendors">Clear</Link>
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="outline">
            <Filter className="size-4" /> Apply
          </Button>
        </div>
      </FilterBar>

      <ActiveFilters
        basePath="/vendors"
        params={params}
        filters={[
          { key: "q", label: "Search", value: params.q },
          { key: "category", label: "Category", value: params.category },
          {
            key: "status",
            label: "Status",
            value: params.status,
            display: params.status === "ACTIVE" ? "Active" : params.status === "INACTIVE" ? "Inactive" : undefined,
          },
          {
            key: "compliance",
            label: "Compliance",
            value: params.compliance,
            display:
              params.compliance === "COMPLIANT"
                ? "Compliant"
                : params.compliance === "PENDING"
                  ? "Pending"
                  : params.compliance === "NON_COMPLIANT"
                    ? "Non-compliant"
                    : undefined,
          },
        ]}
      />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={hasFilters ? "No vendors match those filters" : "No vendors yet"}
            description={
              hasFilters
                ? "Try a different category or clear the compliance filter."
                : "Add your first vendor to start recording quotations and building scoring history."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/vendors">Clear filters</Link>
                </Button>
              ) : canWrite ? (
                <VendorFormDialog trigger={<Button size="sm">Add vendor</Button>} />
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Vendor</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead className="hidden md:table-cell">Performance</TableHead>
                    <TableHead className="hidden lg:table-cell">Reliability</TableHead>
                    <TableHead className="text-right">Awarded</TableHead>
                    <TableHead className="hidden text-right xl:table-cell">Quotes</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((vendor) => (
                    <TableRowLink
                      key={vendor.id}
                      href={`/vendors/${vendor.id}`}
                      label={`Open vendor ${vendor.name}`}
                    >
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium group-hover:text-indigo-700">{vendor.name}</span>
                          <span className="text-[10px] text-muted-foreground">{vendor.category}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {vendor.contactName} · {vendor.email}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={vendor.status === "ACTIVE" ? "success" : "neutral"}>
                          {vendor.status === "ACTIVE" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ComplianceBadge status={vendor.complianceStatus} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <RatingBar value={vendor.performanceRating} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RatingBar value={vendor.deliveryReliability} />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular">
                        {formatMoney(vendor.awardedValue, user.currency, { compact: vendor.awardedValue > 999_999 })}
                      </TableCell>
                      <TableCell className="hidden text-right text-sm text-muted-foreground xl:table-cell">
                        {vendor.quotationCount}
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
              {rows.map((vendor) => (
                <li key={vendor.id}>
                  <Link
                    href={`/vendors/${vendor.id}`}
                    className="block px-4 py-3.5 transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{vendor.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {vendor.category} · {vendor.contactName}
                        </p>
                      </div>
                      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-zinc-300" aria-hidden />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ComplianceBadge status={vendor.complianceStatus} />
                        <Badge variant={vendor.status === "ACTIVE" ? "success" : "neutral"}>
                          {vendor.status === "ACTIVE" ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold tabular">
                        {formatMoney(vendor.awardedValue, user.currency, { compact: vendor.awardedValue > 999_999 })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        {total} vendor{total === 1 ? "" : "s"} · ratings update automatically from recorded evaluations.
      </p>
    </div>
  );
}

function RatingBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">Not rated</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={
            value >= 80 ? "h-full rounded-full bg-emerald-500" : value >= 55 ? "h-full rounded-full bg-indigo-500" : "h-full rounded-full bg-amber-500"
          }
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs tabular text-muted-foreground">{value}</span>
    </div>
  );
}
