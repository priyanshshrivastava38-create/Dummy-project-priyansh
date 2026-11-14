import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckSquare2,
  ChevronRight,
  Clock3,
  FilePenLine,
  FileText,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { defaultRange, getAnalytics, getDashboardPendingApprovals } from "@/lib/services/analytics";
import { derivedContractStatus } from "@/lib/services/contracts";
import { getAiStatus } from "@/lib/ai/provider";
import { cn, formatDate, formatMoney, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/status-badge";
import { SpendTrendChart, DepartmentBarChart, ChartLegend } from "@/components/app/charts";
import { AskBar } from "@/components/app/ask-bar";

export const metadata = { title: "Overview" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function daysLabel(days: number | null) {
  if (days === null) return "No decisions yet";
  return `${days.toFixed(1)} days`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const [data, pendingApprovals, contractWatch, draftCount] = await Promise.all([
    getAnalytics(user, defaultRange()),
    getDashboardPendingApprovals(user),
    prisma.contract.findMany({
      where: { orgId: user.orgId, status: { notIn: ["TERMINATED", "RENEWED", "DRAFT"] } },
      select: { status: true, endDate: true, renewalDate: true },
    }),
    prisma.purchaseRequest.count({
      where: { orgId: user.orgId, requesterId: user.id, status: "DRAFT" },
    }),
  ]);
  const ai = getAiStatus();
  const currency = user.currency;
  const firstName = user.fullName.split(" ")[0];
  const trendHasData = data.monthlyTrend.some((m) => m.spend > 0 || m.savings > 0);
  const deptHasData = data.departmentSpend.some((d) => d.spend > 0);
  const unread = pendingApprovals.length;
  const expiringContracts = contractWatch.filter((contract) => derivedContractStatus(contract) === "EXPIRING").length;
  const complianceGaps = data.vendors.filter((vendor) => vendor.complianceStatus !== "COMPLIANT").length;
  const nonCompliant = data.vendors.filter((vendor) => vendor.complianceStatus === "NON_COMPLIANT").length;

  const attention = [
    {
      label: "Approvals waiting",
      value: unread,
      hint: unread > 0 ? "Assigned to you right now" : "Nothing assigned to you",
      href: "/approvals",
      icon: CheckSquare2,
      tone: "border-amber-100 bg-amber-50 text-amber-600",
    },
    {
      label: "Renewals within 90 days",
      value: expiringContracts,
      hint: expiringContracts > 0 ? "Review terms before they lapse" : "No contracts expiring soon",
      href: "/contracts?window=90",
      icon: CalendarClock,
      tone: "border-sky-100 bg-sky-50 text-sky-600",
    },
    {
      label: "Compliance gaps",
      value: complianceGaps,
      hint: complianceGaps > 0 ? `${nonCompliant} non-compliant · ${complianceGaps - nonCompliant} pending` : "All vendors compliant",
      href: "/vendors",
      icon: ShieldAlert,
      tone: "border-rose-100 bg-rose-50 text-rose-600",
    },
    {
      label: "Your draft requests",
      value: draftCount,
      hint: draftCount > 0 ? "Finish and submit for approval" : "No unfinished drafts",
      href: "/requests?status=DRAFT",
      icon: FilePenLine,
      tone: "border-indigo-100 bg-indigo-50 text-indigo-600",
    },
  ];
  const attentionTotal = attention.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Demo workspace · ${user.orgName}`}
        title={`${greeting()}, ${firstName}`}
        description="Spend, sourcing and approvals across your organisation — calculated live from the seeded procurement ledger."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/analytics">
                <TrendingDown className="size-4" /> Analytics
              </Link>
            </Button>
            <Button asChild>
              <Link href="/requests/new">
                <FileText className="size-4" /> New request
              </Link>
            </Button>
          </>
        }
      />

      {denied ? (
        <Alert tone="warning" title="You do not have access to that area">
          Your role — {titleCase(user.role)} — does not include that permission. Ask an administrator if you need
          broader access.
        </Alert>
      ) : null}

      <div className="reveal reveal-1">
        <AskBar />
      </div>

      <Card className="reveal reveal-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b bg-gradient-to-r from-indigo-50/80 via-white to-transparent px-4 py-2.5">
          <span className="relative flex size-6 items-center justify-center rounded-md bg-indigo-600 text-white">
            <span
              className="absolute inset-0 rounded-md"
              style={{ animation: "ring-pulse 2.8s ease-out infinite" }}
              aria-hidden
            />
            <Zap className="size-3.5" />
          </span>
          <p className="text-sm font-semibold">Needs attention</p>
          <Badge variant={attentionTotal > 0 ? "warning" : "success"}>
            {attentionTotal > 0 ? `${attentionTotal} open` : "All clear"}
          </Badge>
          <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
            Each count links straight to the filtered list
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
          {attention.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-start gap-3 p-4 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
                    item.tone,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-xl font-semibold tabular",
                        item.value === 0 ? "text-zinc-300" : "text-foreground",
                      )}
                    >
                      {item.value}
                    </span>
                    <span className="truncate text-xs font-medium text-zinc-700">{item.label}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="reveal reveal-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Awarded spend"
          value={formatMoney(data.totals.totalSpend, currency, { compact: data.totals.totalSpend > 999_999 })}
          hint={`${data.totals.awardCount} awarded request${data.totals.awardCount === 1 ? "" : "s"} · last 6 months`}
          icon={Banknote}
          tone="indigo"
          href="/analytics"
        />
        <StatCard
          label="Savings vs budget"
          value={formatMoney(data.totals.savings, currency, { compact: data.totals.savings > 999_999 })}
          hint={
            data.totals.savingsPct === null
              ? "No awarded quotations yet"
              : `${data.totals.savingsPct.toFixed(1)}% below estimated budget`
          }
          icon={Sparkles}
          tone="emerald"
          href="/analytics"
        />
        <StatCard
          label="Pending approvals"
          value={String(data.totals.pendingApprovals)}
          hint={unread > 0 ? `${unread} assigned to you` : "No steps assigned to you"}
          icon={CheckSquare2}
          tone={unread > 0 ? "amber" : "default"}
          href="/approvals"
        />
        <StatCard
          label="Active vendors"
          value={String(data.totals.activeVendors)}
          hint={`${data.vendors.length} in directory`}
          icon={Building2}
          tone="sky"
          href="/vendors"
        />
        <StatCard
          label="Avg approval time"
          value={daysLabel(data.totals.avgApprovalDays)}
          hint={
            data.totals.avgCycleDays === null
              ? "Cycle time starts after first delivery"
              : `${data.totals.avgCycleDays.toFixed(1)} days request-to-complete`
          }
          icon={Clock3}
          tone="default"
          href="/analytics"
        />
      </div>

      <div className="reveal reveal-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Spend & savings trend</CardTitle>
              <CardDescription>Awarded quotation value by decision month, current range.</CardDescription>
            </div>
            <ChartLegend
              items={[
                { label: "Awarded spend", color: "#6366f1" },
                { label: "Savings", color: "#10b981" },
              ]}
            />
          </CardHeader>
          <CardContent>
            {trendHasData ? (
              <SpendTrendChart data={data.monthlyTrend} currency={currency} />
            ) : (
              <EmptyState
                icon={TrendingDown}
                title="No awarded spend in this window"
                description="Select a vendor on an approved request to start building the spend trend."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/requests">Open purchase requests</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Waiting on you</CardTitle>
              <CardDescription>Approval steps assigned to your role.</CardDescription>
            </div>
            {unread > 0 ? (
              <Badge variant="warning">{unread} pending</Badge>
            ) : (
              <Badge variant="neutral">Clear</Badge>
            )}
          </CardHeader>
          <CardContent className="flex-1">
            {pendingApprovals.length === 0 ? (
              <EmptyState
                icon={CheckSquare2}
                title="Your approval queue is clear"
                description="Submitted requests that need your level will appear here, oldest first."
              />
            ) : (
              <ul className="divide-y">
                {pendingApprovals.map((step) => (
                  <li key={step.id}>
                    <Link
                      href={`/requests/${step.requestId}`}
                      className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-zinc-50"
                    >
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-white text-[11px] font-semibold text-zinc-500">
                        L{step.level}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-indigo-700">
                          {step.request.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {step.request.reference} · {step.request.department?.name ?? "No department"} ·{" "}
                          {formatMoney(step.request.estimatedBudget, currency)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <PriorityBadge priority={step.request.priority} />
                          <span className="text-[11px] text-muted-foreground">
                            by {step.request.requester.fullName}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="mt-1 size-4 text-zinc-300 transition-colors group-hover:text-indigo-500" />
                    </Link>
                  </li>
                ))}
                <li className="pt-3">
                  <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                    <Link href="/approvals">
                      Open approval workspace <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="reveal reveal-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Department spend</CardTitle>
              <CardDescription>Awarded spend against annual department budgets.</CardDescription>
            </div>
            <ChartLegend
              items={[
                { label: "Awarded", color: "#6366f1" },
                { label: "Budget", color: "#e4e4e7" },
              ]}
            />
          </CardHeader>
          <CardContent>
            {deptHasData ? (
              <DepartmentBarChart data={data.departmentSpend} currency={currency} />
            ) : (
              <EmptyState
                icon={Building2}
                title="No department spend yet"
                description="Once quotations are awarded the budget comparison fills in automatically."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Auditable events from across the workspace.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analytics">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentActivities.length === 0 ? (
              <EmptyState
                icon={Clock3}
                title="No activity yet"
                description="Creating a request or quotation will start the activity trail."
              />
            ) : (
              <ol className="relative space-y-0">
                {data.recentActivities.slice(0, 7).map((activity, index) => (
                  <li key={activity.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < Math.min(data.recentActivities.length, 7) - 1 ? (
                      <span className="absolute left-[5px] top-3 h-full w-px bg-border" aria-hidden />
                    ) : null}
                    <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white bg-indigo-400 ring-1 ring-indigo-200" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-zinc-700">{activity.summary}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {activity.actor.fullName} · {formatDate(activity.createdAt)}
                        {activity.requestId ? (
                          <>
                            {" · "}
                            <Link
                              href={`/requests/${activity.requestId}`}
                              className="font-medium text-indigo-600 hover:underline"
                            >
                              {activity.entityType === "Quotation" ? "Quotation" : "Request"}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="reveal reveal-5 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-violet-300/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="float-slow flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                AI quotation extraction {ai.available ? "is ready" : "needs configuration"}
              </p>
              <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                {ai.available
                  ? `${ai.label} · ${ai.model}. Upload a PDF quotation to extract line items, payment terms and delivery days into an editable draft. Managers still make the award decision.`
                  : "Add GEMINI_API_KEY or OLLAMA_BASE_URL to enable PDF extraction. Every request, quotation and approval flow works without it."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={ai.available ? "success" : "warning"}>{ai.available ? "Configured" : "Manual mode"}</Badge>
            <Button size="sm" variant="outline" asChild>
              <Link href="/requests">
                Try it <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid divide-y border-t text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center justify-between gap-2 px-5 py-3">
            <span className="text-muted-foreground">Requests tracked</span>
            <span className="font-medium tabular">{data.totals.totalRequests}</span>
          </div>
          <div className="flex items-center justify-between gap-2 px-5 py-3">
            <span className="text-muted-foreground">Awaiting decision</span>
            <span className="font-medium tabular">{data.totals.pendingRequests}</span>
          </div>
          <div className="flex items-center justify-between gap-2 px-5 py-3">
            <span className="text-muted-foreground">Compliance gaps</span>
            <span className="font-medium tabular">
              {data.vendors.filter((v) => v.complianceStatus !== "COMPLIANT").length}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
