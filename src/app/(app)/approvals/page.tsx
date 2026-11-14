import Link from "next/link";
import { CheckSquare2, Clock3, Info, ShieldCheck, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getApprovalWorkspace } from "@/lib/services/approvals";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";
import { ApprovalDecision } from "@/components/app/approval-decision";

export const metadata = { title: "Approvals" };

function waitingDays(date: Date | null) {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

export default async function ApprovalsPage() {
  const user = await requirePermission("approval:read");
  const { assigned, decided, oversight } = await getApprovalWorkspace(user);
  const isOversight = user.role === "ADMIN" || user.role === "PROCUREMENT_MANAGER";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Module F"
        title="Approval workspace"
        description="Level-based approvals with mandatory rejection reasons, clarification requests and a permanent audit trail."
        actions={
          <Badge variant={assigned.length > 0 ? "warning" : "success"}>
            {assigned.length > 0 ? `${assigned.length} waiting on you` : "Queue clear"}
          </Badge>
        }
      />

      <Alert tone="info" title="Separation of duties is enforced on the server">
        Approvers cannot act on requests they raised, and only the assigned approver or an administrator can decide a
        step. Rejections and clarification requests require a written reason.
      </Alert>

      <Tabs defaultValue="assigned">
        <TabsList>
          <TabsTrigger value="assigned">
            <CheckSquare2 className="mr-1.5 size-3.5" /> Assigned
            {assigned.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
                {assigned.length}
              </span>
            ) : null}
          </TabsTrigger>
          {isOversight ? (
            <TabsTrigger value="oversight">
              <Users className="mr-1.5 size-3.5" /> Organisation
              {oversight.length > 0 ? (
                <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 text-[10px] font-semibold text-zinc-600">
                  {oversight.length}
                </span>
              ) : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="history">
            <Clock3 className="mr-1.5 size-3.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assigned">
          {assigned.length === 0 ? (
            <Card>
              <EmptyState
                icon={CheckSquare2}
                title="Nothing waiting on you"
                description="Requests appear here when they reach an approval level assigned to you. You can also review any request you can see from the purchase requests list."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/requests">Browse requests</Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {assigned.map((step) => {
                const days = waitingDays(step.activatedAt);
                return (
                  <Card key={step.id} className={days >= 3 ? "border-amber-300" : undefined}>
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="violet">Level {step.level}</Badge>
                          <RequestStatusBadge status={step.request.status} />
                          <PriorityBadge priority={step.request.priority} />
                          {days >= 3 ? <Badge variant="warning">{days}d waiting</Badge> : null}
                        </div>
                        <CardTitle className="truncate text-base">
                          <Link href={`/requests/${step.request.id}`} className="hover:text-indigo-700">
                            {step.request.title}
                          </Link>
                        </CardTitle>
                        <CardDescription>
                          <span className="font-mono text-[11px]">{step.request.reference}</span> ·{" "}
                          {step.request.department.name} · by {step.request.requester.fullName}
                        </CardDescription>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-semibold tabular">
                          {formatMoney(step.request.estimatedBudget, user.currency)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Budget</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="line-clamp-2 text-sm text-muted-foreground">{step.request.description}</p>
                      <div className="flex items-center justify-between gap-2 border-t pt-3">
                        <span className="text-[11px] text-muted-foreground">
                          {step.activatedAt ? `Activated ${formatDate(step.activatedAt)}` : "Awaiting activation"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/requests/${step.request.id}`}>View request</Link>
                          </Button>
                          {can(user.role, "approval:act") && step.request.requesterId !== user.id ? (
                            <ApprovalDecision
                              stepId={step.id}
                              reference={step.request.reference}
                              level={step.level}
                            />
                          ) : (
                            <Badge variant="neutral">Cannot self-approve</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {isOversight ? (
          <TabsContent value="oversight">
            <Card>
              <CardHeader>
                <CardTitle>Pending across the organisation</CardTitle>
                <CardDescription>
                  Read-only oversight of steps assigned to other approvers. Administrators can open a request to act if
                  needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {oversight.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No other pending approvals"
                    description="Everything submitted has been decided or is with you."
                  />
                ) : (
                  oversight.map((step) => {
                    const days = waitingDays(step.activatedAt);
                    return (
                      <Link
                        key={step.id}
                        href={`/requests/${step.request.id}`}
                        className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {step.request.reference}
                            </span>
                            <span className="truncate">{step.request.title}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Level {step.level} · assigned to {step.approver.fullName} ·{" "}
                            {step.request.department.name} · {formatMoney(step.request.estimatedBudget, user.currency)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {days >= 3 ? <Badge variant="warning">{days}d</Badge> : null}
                          <RequestStatusBadge status={step.request.status} />
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Your decisions</CardTitle>
              <CardDescription>The last 25 steps you approved, rejected or sent back for clarification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {decided.length === 0 ? (
                <EmptyState
                  icon={Clock3}
                  title="No decisions recorded yet"
                  description="Your approval history will appear here with timestamps and reasons."
                />
              ) : (
                decided.map((step) => (
                  <div key={step.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/requests/${step.request.id}`}
                        className="flex flex-wrap items-center gap-1.5 text-sm font-medium hover:text-indigo-700"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground">{step.request.reference}</span>
                        <span className="truncate">{step.request.title}</span>
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        Level {step.level} · {step.request.department.name} ·{" "}
                        {formatMoney(step.request.estimatedBudget, user.currency)}
                        {step.decidedAt ? ` · decided ${formatDate(step.decidedAt)}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        step.status === "APPROVED"
                          ? "success"
                          : step.status === "REJECTED"
                            ? "danger"
                            : "info"
                      }
                    >
                      {titleCase(step.status)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            Full organisation-wide history and IP metadata are available to administrators in the audit log.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
