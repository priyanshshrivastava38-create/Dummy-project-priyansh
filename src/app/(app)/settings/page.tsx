import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  KeyRound,
  Settings2,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getSettingsData } from "@/lib/services/settings";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { DEFAULT_WEIGHTS, type CriterionKey } from "@/lib/scoring/engine";
import { formatDate, formatDateTime, formatMoney, toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WeightsEditor } from "@/components/app/weights-editor";
import {
  DepartmentDialog,
  EditDepartmentButton,
  EditPolicyButton,
  EditUserButton,
  PolicyDialog,
  UserDialog,
} from "@/components/app/settings-dialogs";

export const metadata = { title: "Settings" };

const ROLE_TONE: Record<Role, "violet" | "info" | "neutral"> = {
  ADMIN: "violet",
  PROCUREMENT_MANAGER: "info",
  APPROVER: "neutral",
};

const LEVEL_LABEL: Record<number, string> = {
  1: "Manager only",
  2: "Manager + second level",
  3: "Manager + two escalation levels",
};

function resolveWeights(value: unknown): Record<CriterionKey, number> {
  const weights = { ...DEFAULT_WEIGHTS };
  if (value && typeof value === "object") {
    for (const key of Object.keys(weights) as CriterionKey[]) {
      const raw = (value as Record<string, unknown>)[key];
      const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : null;
      if (parsed !== null && Number.isFinite(parsed)) weights[key] = parsed;
    }
  }
  return weights;
}

export default async function SettingsPage() {
  const user = await requirePermission("settings:manage");
  const { organisation, users, departments, policies } = await getSettingsData(user);
  const currency = organisation.currency;
  const weights = resolveWeights(organisation.defaultWeights);
  const activeUsers = users.filter((member) => member.isActive).length;
  const activePolicies = policies.filter((policy) => policy.isActive).length;
  const departmentOptions = departments.map((department) => ({ id: department.id, name: department.name }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Organisation settings"
        description="Manage people, departments, approval policies and the default scoring model. Every change is written to the audit trail."
        actions={
          <Button variant="outline" asChild>
            <Link href="/audit">
              <ShieldCheck className="size-4" /> Audit log
            </Link>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-50 via-white to-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-white text-lg font-semibold text-indigo-700 shadow-xs">
                {organisation.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">{organisation.name}</h2>
                  <Badge variant={organisation.demoMode ? "info" : "neutral"}>
                    {organisation.demoMode ? "Demo workspace" : "Live workspace"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono text-xs">/{organisation.slug}</span> · billed in {currency} · created{" "}
                  {formatDate(organisation.createdAt)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border bg-white/80 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Members</p>
                <p className="text-lg font-semibold tabular">{activeUsers}</p>
              </div>
              <div className="rounded-lg border bg-white/80 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Departments</p>
                <p className="text-lg font-semibold tabular">{departments.length}</p>
              </div>
              <div className="rounded-lg border bg-white/80 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Policies</p>
                <p className="text-lg font-semibold tabular">{activePolicies}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t px-5 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" /> {users.length} accounts total
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5" /> {departments.length} departments
          </span>
          <span className="flex items-center gap-1.5">
            <Workflow className="size-3.5" /> {policies.length} approval policies
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {organisation.demoMode ? "Seeded demo data" : "Production data"}
          </span>
        </div>
      </Card>

      <nav
        aria-label="Settings sections"
        className="sticky top-14 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border bg-white/95 p-1 shadow-xs backdrop-blur scrollbar-thin"
      >
        {[
          { href: "#team", label: "Team", count: users.length, icon: Users },
          { href: "#departments", label: "Departments", count: departments.length, icon: Building2 },
          { href: "#policies", label: "Policies", count: policies.length, icon: Workflow },
          { href: "#scoring", label: "Scoring", icon: Settings2 },
        ].map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Icon className="size-3.5 text-zinc-400" />
              {section.label}
              {section.count !== undefined ? (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                  {section.count}
                </span>
              ) : null}
            </Link>
          );
        })}
        <span className="ml-auto hidden items-center pr-2 text-[10px] text-muted-foreground sm:flex">
          Changes are audited
        </span>
      </nav>

      <Card id="team" className="scroll-mt-28">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle>Team members</CardTitle>
            <CardDescription>
              Administrators manage everything; procurement managers run sourcing; department managers approve their
              own requests.
            </CardDescription>
          </div>
          <UserDialog departments={departmentOptions} />
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={member.fullName} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.fullName}
                          {member.id === user.id ? (
                            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(you)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_TONE[member.role as Role]}>{ROLE_LABELS[member.role as Role]}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {member.department?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.isActive ? "success" : "danger"}>
                      {member.isActive ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <EditUserButton
                      departments={departmentOptions}
                      initial={{
                        id: member.id,
                        fullName: member.fullName,
                        email: member.email,
                        role: member.role as Role,
                        departmentId: member.departmentId ?? "",
                        isActive: member.isActive,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card id="departments" className="scroll-mt-28">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle>Departments &amp; budgets</CardTitle>
            <CardDescription>
              Annual budgets power budget-versus-actual reporting. Department managers are routed first in approvals.
            </CardDescription>
          </div>
          <DepartmentDialog />
        </CardHeader>
        <CardContent className="px-0">
          {departments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Add a department before requesting spend so budgets and approvals have somewhere to route."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Department</TableHead>
                  <TableHead className="hidden sm:table-cell">Head</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Requests</TableHead>
                  <TableHead className="text-right">Annual budget</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="pl-5">
                      <p className="text-sm font-medium">{department.name}</p>
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">{department.code}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {department.head?.fullName ?? <span className="text-muted-foreground">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular">{department._count.members}</TableCell>
                    <TableCell className="hidden text-right text-sm tabular sm:table-cell">
                      {department._count.requests}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular">
                      {department.annualBudget === null ? (
                        <span className="text-muted-foreground">Not set</span>
                      ) : (
                        formatMoney(department.annualBudget, currency)
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <EditDepartmentButton
                        initial={{
                          id: department.id,
                          name: department.name,
                          code: department.code,
                          annualBudget: toNumber(department.annualBudget),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card id="policies" className="scroll-mt-28">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle>Approval policies</CardTitle>
            <CardDescription>
              Policies match estimated budget bands. Rejection reasons are mandatory and auditors see every decision.
            </CardDescription>
          </div>
          <PolicyDialog />
        </CardHeader>
        <CardContent className="px-0">
          {policies.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No approval policies"
              description="Requests will fall back to the department-manager chain. Add a policy to formalise spend bands."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Policy</TableHead>
                  <TableHead>Spend band</TableHead>
                  <TableHead className="hidden sm:table-cell">Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="pl-5 text-sm font-medium">{policy.name}</TableCell>
                    <TableCell className="text-sm tabular">
                      {formatMoney(policy.minAmount, currency, { compact: true })}
                      {policy.maxAmount === null ? " and above" : ` – ${formatMoney(policy.maxAmount, currency, { compact: true })}`}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {LEVEL_LABEL[policy.levels] ?? `${policy.levels} levels`}
                      {policy.levels >= 2 && policy.secondLevelRole
                        ? ` · ${ROLE_LABELS[policy.secondLevelRole as Role]}`
                        : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={policy.isActive ? "success" : "neutral"}>
                        {policy.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <EditPolicyButton
                        initial={{
                          id: policy.id,
                          name: policy.name,
                          minAmount: toNumber(policy.minAmount) ?? 0,
                          maxAmount: toNumber(policy.maxAmount),
                          levels: policy.levels,
                          secondLevelRole: policy.secondLevelRole as "ADMIN" | "PROCUREMENT_MANAGER" | null,
                          isActive: policy.isActive,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card id="scoring" className="scroll-mt-28 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-4 text-indigo-600" /> Default scoring weights
            </CardTitle>
            <CardDescription>
              Applied to new requests. Scores are still computed deterministically — the AI only explains results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeightsEditor
              initial={weights}
              mode="default"
              sourceLabel={`Organisation default · ${organisation.name}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-indigo-600" /> Governance
            </CardTitle>
            <CardDescription>Guardrails that hold for every role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p>Permissions are checked on the server for each action, not just hidden in the navigation.</p>
            </div>
            <div className="flex gap-2.5">
              <Users className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p>Segregation of duties blocks anyone from approving their own request.</p>
            </div>
            <div className="flex gap-2.5">
              <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p>Last active administrator cannot be demoted or deactivated.</p>
            </div>
            <div className="border-t pt-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/audit">
                  <ShieldCheck className="size-4" /> Review audit trail
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
