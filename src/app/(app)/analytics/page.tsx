import Link from "next/link";
import {
  CalendarRange,
  Clock3,
  Download,
  Gauge,
  Timer,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getAnalytics, parseRange } from "@/lib/services/analytics";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartLegend,
  DepartmentBarChart,
  SpendTrendChart,
  VendorSpendChart,
  BottleneckChart,
} from "@/components/app/charts";

export const metadata = { title: "Procurement analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("analytics:read");
  const params = await searchParams;
  const range = parseRange(params.from, params.to);
  const data = await getAnalytics(user, range);
  const currency = user.currency;
  const fromValue = range.from.toISOString().slice(0, 10);
  const toValue = range.to.toISOString().slice(0, 10);
  const exportHref = `/api/analytics/export?from=${fromValue}&to=${toValue}`;
  const hasSpend = data.totals.awardCount > 0;
  const budgetRows = data.departmentSpend.filter((dept) => dept.budget !== null);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Module G"
        title="Procurement analytics"
        description="Spend, savings, cycle time and approval bottlenecks across the selected period — calculated from the ledger."
        actions={
          <Button variant="outline" asChild>
            <a href={exportHref} download>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        }
      />

      <form
        method="get"
        className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="space-y-1">
          <label htmlFor="from" className="text-[11px] font-medium text-muted-foreground">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={fromValue}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-[11px] font-medium text-muted-foreground">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={toValue}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          <CalendarRange className="size-4" /> Apply range
        </Button>
        <p className="text-[11px] text-muted-foreground sm:ml-auto">
          {formatDate(range.from)} – {formatDate(range.to)} · {data.totals.totalRequests} requests in scope ·{" "}
          {data.totals.awardCount} awarded
        </p>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Awarded spend"
          value={formatMoney(data.totals.totalSpend, currency, { compact: data.totals.totalSpend > 999_999 })}
          hint={`${data.totals.awardCount} awards in range`}
          icon={Wallet}
          tone="indigo"
        />
        <StatCard
          label="Savings vs estimate"
          value={formatMoney(data.totals.savings, currency, { compact: data.totals.savings > 999_999 })}
          hint={data.totals.savingsPct === null ? "No awards yet" : `${data.totals.savingsPct.toFixed(1)}% below budget`}
          icon={TrendingDown}
          tone="emerald"
        />
        <StatCard
          label="Avg approval time"
          value={data.totals.avgApprovalDays === null ? "—" : `${data.totals.avgApprovalDays.toFixed(1)}d`}
          hint="Submission to final approval"
          icon={Timer}
          tone="amber"
        />
        <StatCard
          label="Avg cycle time"
          value={data.totals.avgCycleDays === null ? "—" : `${data.totals.avgCycleDays.toFixed(1)}d`}
          hint="Submission to completion"
          icon={Gauge}
          tone="sky"
        />
        <StatCard
          label="Pending approvals"
          value={String(data.totals.pendingApprovals)}
          hint={`${data.pendingAging.length} total open steps`}
          icon={Clock3}
          tone="default"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Monthly spend & savings</CardTitle>
              <CardDescription>Awarded quotation value by decision month inside the range.</CardDescription>
            </div>
            <ChartLegend
              items={[
                { label: "Spend", color: "#6366f1" },
                { label: "Savings", color: "#10b981" },
              ]}
            />
          </CardHeader>
          <CardContent>
            {hasSpend ? (
              <SpendTrendChart data={data.monthlyTrend} currency={currency} />
            ) : (
              <EmptyState
                icon={TrendingDown}
                title="No awards in this range"
                description="Adjust the date range or select vendors on approved requests to populate spend analytics."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department spend</CardTitle>
            <CardDescription>Awarded value against annual budgets.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasSpend ? (
              <DepartmentBarChart data={data.departmentSpend} currency={currency} />
            ) : (
              <EmptyState
                icon={Wallet}
                title="Nothing awarded yet"
                description="Department spend appears once quotations are selected."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendor spend</CardTitle>
            <CardDescription>Top vendors by awarded value in this period.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.vendorSpend.length > 0 ? (
              <VendorSpendChart data={data.vendorSpend} currency={currency} />
            ) : (
              <EmptyState
                icon={Wallet}
                title="No vendor awards"
                description="Selected quotations will rank vendors here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval bottlenecks</CardTitle>
            <CardDescription>Average decision time by approval level.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.approvalBottlenecks.length > 0 ? (
              <>
                <BottleneckChart data={data.approvalBottlenecks} />
                <div className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                  {data.approvalBottlenecks.map((level) => (
                    <div key={level.level} className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Level {level.level} · {level.count} decision{level.count === 1 ? "" : "s"}
                      </span>
                      <span className="font-medium tabular">{level.avgDays} days avg</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={Gauge}
                title="No approval decisions in range"
                description="Bottleneck analysis fills in once approvers act on requests."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budget vs actual</CardTitle>
            <CardDescription>Current-year awarded spend against each department&apos;s annual budget.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetRows.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No department budgets configured"
                description="Administrators can add annual budgets in Settings."
              />
            ) : (
              budgetRows.map((dept) => {
                const pct = dept.budget && dept.budget > 0 ? (dept.ytdSpend / dept.budget) * 100 : 0;
                const remaining = (dept.budget ?? 0) - dept.ytdSpend;
                return (
                  <div key={dept.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{dept.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatMoney(dept.ytdSpend, currency, { compact: true })} of{" "}
                        {formatMoney(dept.budget, currency, { compact: true })}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      indicatorClassName={
                        pct > 95 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-indigo-500"
                      }
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{pct.toFixed(1)}% of annual budget</span>
                      <span className={remaining < 0 ? "text-red-600" : ""}>
                        {remaining < 0
                          ? `${formatMoney(Math.abs(remaining), currency)} over`
                          : `${formatMoney(remaining, currency)} remaining`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approver performance</CardTitle>
            <CardDescription>Slowest average decision time in this range.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.approverPerformance.length === 0 ? (
              <EmptyState
                icon={Timer}
                title="No decisions in range"
                description="Approver timing appears once steps are decided."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Approver</TableHead>
                    <TableHead className="text-right">Decisions</TableHead>
                    <TableHead className="pr-5 text-right">Avg days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.approverPerformance.map((approver) => (
                    <TableRow key={approver.name}>
                      <TableCell className="pl-5 text-sm font-medium">{approver.name}</TableCell>
                      <TableCell className="text-right text-sm tabular">{approver.count}</TableCell>
                      <TableCell className="pr-5 text-right">
                        <Badge variant={approver.avgDays > 2 ? "warning" : "neutral"}>
                          {approver.avgDays}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending approval aging</CardTitle>
          <CardDescription>Open steps sorted by how long they have been waiting, oldest first.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {data.pendingAging.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="No pending approvals"
              description="Every submitted request has cleared its approval chain."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Request</TableHead>
                  <TableHead className="hidden sm:table-cell">Department</TableHead>
                  <TableHead className="hidden md:table-cell">Approver</TableHead>
                  <TableHead className="hidden sm:table-cell">Level</TableHead>
                  <TableHead className="pr-5 text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pendingAging.slice(0, 12).map((step) => (
                  <TableRow key={step.id}>
                    <TableCell className="pl-5">
                      <Link href={`/requests/${step.requestId}`} className="block hover:text-indigo-700">
                        <span className="font-mono text-[10px] text-muted-foreground">{step.reference}</span>
                        <span className="block max-w-[320px] truncate text-sm font-medium">{step.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {step.department ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{step.approver}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="neutral">L{step.level}</Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Badge variant={step.daysWaiting >= 3 ? "danger" : step.daysWaiting >= 1 ? "warning" : "success"}>
                        {step.daysWaiting}d
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
