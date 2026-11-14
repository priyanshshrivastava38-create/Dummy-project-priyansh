import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { daysBetween, toNumber } from "@/lib/utils";
import { ServiceError } from "./errors";
import { requestScope } from "./requests";

export type AnalyticsRange = { from: Date; to: Date };

export function defaultRange(): AnalyticsRange {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59));
  return { from, to: end };
}

export function parseRange(fromRaw?: string | null, toRaw?: string | null): AnalyticsRange {
  const fallback = defaultRange();
  const parse = (value: string | null | undefined, endOfDay: boolean) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parse(fromRaw, false) ?? fallback.from;
  const to = parse(toRaw, true) ?? fallback.to;
  if (from > to) return { from: to, to: from };
  return { from, to };
}

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function monthsBetween(from: Date, to: Date) {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end && months.length < 24) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export async function getAnalytics(user: SessionUser, range: AnalyticsRange) {
  if (!can(user.role, "analytics:read")) {
    throw new ServiceError("You do not have permission to view analytics.", "FORBIDDEN");
  }

  const [requests, vendors, departments, pendingSteps, recentActivities] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: requestScope(user),
      include: {
        department: { select: { id: true, name: true, annualBudget: true } },
        recommendedVendor: { select: { id: true, name: true } },
        quotations: {
          where: { status: "SELECTED" },
          select: { id: true, totalAmount: true, vendorId: true, vendor: { select: { name: true } } },
        },
        approvalSteps: {
          include: { approver: { select: { id: true, fullName: true } } },
          orderBy: { level: "asc" },
        },
      },
    }),
    prisma.vendor.findMany({
      where: { orgId: user.orgId },
      select: {
        id: true,
        name: true,
        status: true,
        performanceRating: true,
        deliveryReliability: true,
        complianceStatus: true,
        _count: { select: { quotations: true, evaluations: true } },
      },
    }),
    prisma.department.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true, annualBudget: true },
      orderBy: { name: "asc" },
    }),
    prisma.approvalStep.findMany({
      where: { status: "PENDING", request: requestScope(user) },
      include: {
        approver: { select: { id: true, fullName: true } },
        request: { select: { id: true, reference: true, title: true, department: { select: { name: true } } } },
      },
      orderBy: { activatedAt: "asc" },
    }),
    prisma.activity.findMany({
      where: { orgId: user.orgId },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const inRange = (date: Date | null | undefined) =>
    !!date && date.getTime() >= range.from.getTime() && date.getTime() <= range.to.getTime();

  const awarded = requests
    .map((request) => {
      const selected = request.quotations[0];
      const award = selected ? toNumber(selected.totalAmount) : null;
      const decisionDate = request.approvedAt ?? request.createdAt;
      return {
        request,
        selected,
        award,
        decisionDate,
        estimated: toNumber(request.estimatedBudget) ?? 0,
      };
    })
    .filter((row) => row.selected && row.award !== null && inRange(row.decisionDate));

  const totalSpend = awarded.reduce((sum, row) => sum + (row.award ?? 0), 0);
  const estimatedTotal = awarded.reduce((sum, row) => sum + row.estimated, 0);
  const savings = awarded.reduce((sum, row) => sum + Math.max(0, row.estimated - (row.award ?? 0)), 0);

  const approvedWithinRange = requests.filter((r) => inRange(r.approvedAt));
  const approvalDurations = approvedWithinRange
    .filter((r) => r.submittedAt && r.approvedAt)
    .map((r) => daysBetween(r.submittedAt!, r.approvedAt!));
  const avgApprovalDays = approvalDurations.length
    ? approvalDurations.reduce((a, b) => a + b, 0) / approvalDurations.length
    : null;

  const completedWithinRange = requests.filter((r) => inRange(r.completedAt));
  const cycleDurations = completedWithinRange
    .filter((r) => r.submittedAt && r.completedAt)
    .map((r) => daysBetween(r.submittedAt!, r.completedAt!));
  const avgCycleDays = cycleDurations.length
    ? cycleDurations.reduce((a, b) => a + b, 0) / cycleDurations.length
    : null;

  const trendKeys = monthsBetween(range.from, range.to);
  const trendMap = new Map(trendKeys.map((key) => [key, { spend: 0, count: 0, savings: 0 }]));
  for (const row of awarded) {
    const key = monthKey(row.decisionDate);
    const bucket = trendMap.get(key);
    if (bucket) {
      bucket.spend += row.award ?? 0;
      bucket.savings += Math.max(0, row.estimated - (row.award ?? 0));
      bucket.count += 1;
    }
  }

  const deptMap = new Map<string, { name: string; spend: number; count: number; budget: number | null }>();
  for (const dept of departments) {
    deptMap.set(dept.id, {
      name: dept.name,
      spend: 0,
      count: 0,
      budget: toNumber(dept.annualBudget),
    });
  }
  for (const row of awarded) {
    const entry = deptMap.get(row.request.departmentId);
    if (entry) {
      entry.spend += row.award ?? 0;
      entry.count += 1;
    }
  }

  // Budget vs actual uses the current calendar year to keep annual budgets comparable.
  const currentYear = range.to.getUTCFullYear();
  const ytdSpend = new Map<string, number>();
  for (const request of requests) {
    const selected = request.quotations[0];
    const award = selected ? toNumber(selected.totalAmount) : null;
    if (award === null) continue;
    const date = request.approvedAt ?? request.createdAt;
    if (date.getUTCFullYear() !== currentYear) continue;
    ytdSpend.set(request.departmentId, (ytdSpend.get(request.departmentId) ?? 0) + award);
  }

  const vendorMap = new Map<string, { name: string; spend: number; awards: number }>();
  for (const row of awarded) {
    const vendorName = row.selected?.vendor.name ?? row.request.recommendedVendor?.name ?? "Unknown";
    const vendorId = row.selected?.vendorId ?? row.request.recommendedVendorId ?? vendorName;
    const entry = vendorMap.get(vendorId) ?? { name: vendorName, spend: 0, awards: 0 };
    entry.spend += row.award ?? 0;
    entry.awards += 1;
    vendorMap.set(vendorId, entry);
  }

  const levelStats = new Map<number, { totalDays: number; count: number }>();
  const approverStats = new Map<string, { name: string; totalDays: number; count: number }>();
  for (const request of requests) {
    for (const step of request.approvalSteps) {
      if (!step.activatedAt || !step.decidedAt) continue;
      if (!inRange(step.decidedAt)) continue;
      const duration = daysBetween(step.activatedAt, step.decidedAt);
      const level = levelStats.get(step.level) ?? { totalDays: 0, count: 0 };
      level.totalDays += duration;
      level.count += 1;
      levelStats.set(step.level, level);

      const approver = approverStats.get(step.approverId) ?? { name: step.approver.fullName, totalDays: 0, count: 0 };
      approver.totalDays += duration;
      approver.count += 1;
      approverStats.set(step.approverId, approver);
    }
  }

  const now = Date.now();
  const statusCounts: Record<string, number> = {};
  for (const request of requests) {
    statusCounts[request.status] = (statusCounts[request.status] ?? 0) + 1;
  }

  const pendingAging = pendingSteps
    .map((step) => ({
      id: step.id,
      requestId: step.request.id,
      reference: step.request.reference,
      title: step.request.title,
      department: step.request.department?.name ?? null,
      approver: step.approver.fullName,
      level: step.level,
      daysWaiting: step.activatedAt ? Math.floor((now - step.activatedAt.getTime()) / 86_400_000) : 0,
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  const activeVendorCount = vendors.filter((v) => v.status === "ACTIVE").length;

  const monthlyTrend = trendKeys.map((key) => ({
    month: monthLabel(key),
    spend: Math.round((trendMap.get(key)?.spend ?? 0) * 100) / 100,
    count: trendMap.get(key)?.count ?? 0,
    savings: Math.round((trendMap.get(key)?.savings ?? 0) * 100) / 100,
  }));

  const departmentSpend = Array.from(deptMap.values())
    .map((d, index) => ({
      ...d,
      id: Array.from(deptMap.keys())[index],
      spend: Math.round(d.spend * 100) / 100,
      budget: d.budget,
      ytdSpend: Math.round((ytdSpend.get(Array.from(deptMap.keys())[index]) ?? 0) * 100) / 100,
    }))
    .sort((a, b) => b.spend - a.spend);

  const vendorSpend = Array.from(vendorMap.values())
    .map((v) => ({ ...v, spend: Math.round(v.spend * 100) / 100 }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);

  const approvalBottlenecks = Array.from(levelStats.entries())
    .map(([level, stats]) => ({
      level,
      avgDays: Math.round((stats.totalDays / stats.count) * 10) / 10,
      count: stats.count,
    }))
    .sort((a, b) => a.level - b.level);

  const approverPerformance = Array.from(approverStats.values())
    .map((stats) => ({
      name: stats.name,
      avgDays: Math.round((stats.totalDays / stats.count) * 10) / 10,
      count: stats.count,
    }))
    .sort((a, b) => b.avgDays - a.avgDays)
    .slice(0, 6);

  return {
    range,
    totals: {
      totalSpend,
      estimatedTotal,
      savings,
      savingsPct: estimatedTotal > 0 ? (savings / estimatedTotal) * 100 : null,
      pendingRequests: requests.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length,
      pendingApprovals: pendingSteps.length,
      activeVendors: activeVendorCount,
      avgApprovalDays,
      avgCycleDays,
      awardCount: awarded.length,
      totalRequests: requests.length,
    },
    monthlyTrend,
    departmentSpend,
    vendorSpend,
    approvalBottlenecks,
    approverPerformance,
    pendingAging,
    statusCounts,
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      status: v.status,
      performanceRating: v.performanceRating,
      deliveryReliability: v.deliveryReliability,
      complianceStatus: v.complianceStatus,
      quotationCount: v._count.quotations,
      evaluationCount: v._count.evaluations,
    })),
    recentActivities,
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;

export async function getDashboardPendingApprovals(user: SessionUser) {
  const steps = await prisma.approvalStep.findMany({
    where: {
      status: "PENDING",
      approverId: user.id,
      request: { orgId: user.orgId },
    },
    include: {
      request: {
        select: {
          id: true,
          reference: true,
          title: true,
          estimatedBudget: true,
          priority: true,
          department: { select: { name: true } },
          requester: { select: { fullName: true } },
        },
      },
    },
    orderBy: { activatedAt: "asc" },
    take: 6,
  });
  return steps;
}
