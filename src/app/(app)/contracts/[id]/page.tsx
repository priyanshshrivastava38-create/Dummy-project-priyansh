import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = { title: "Contract" };
import {
  Building2,
  CalendarClock,
  CalendarRange,
  Download,
  FileText,
  RefreshCw,
  ScrollText,
  UserRound,
  Wallet,
} from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getContract, getVendorOptionsForContracts } from "@/lib/services/contracts";
import { renewContractAction, uploadContractDocumentAction } from "@/app/actions/contracts";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ContractStatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/app/action-button";
import { UploadPdfForm } from "@/components/app/upload-pdf-form";
import { ContractDialog, EditContractButton } from "@/components/app/contract-dialog";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("contract:read");
  const { id } = await params;
  const contract = await getContract(user, id);
  if (!contract) notFound();

  const vendors = can(user.role, "contract:write") ? await getVendorOptionsForContracts(user) : [];
  const canWrite = can(user.role, "contract:write");
  const currency = user.currency;
  const totalDays = Math.max(
    1,
    Math.round((contract.endDate.getTime() - contract.startDate.getTime()) / 86_400_000),
  );
  const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - (contract.daysToExpiry ?? totalDays)));
  const elapsedPct = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  const renewalDays = contract.daysToRenewal;
  const isOpen = !["TERMINATED", "RENEWED"].includes(contract.displayStatus);

  const editInitial = {
    id: contract.id,
    title: contract.title,
    vendorId: contract.vendorId,
    value: Number(contract.value),
    startDate: contract.startDate.toISOString().slice(0, 10),
    endDate: contract.endDate.toISOString().slice(0, 10),
    renewalDate: contract.renewalDate ? contract.renewalDate.toISOString().slice(0, 10) : "",
    status: contract.status,
    notes: contract.notes ?? "",
  };

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Overview", href: "/dashboard" },
            { label: "Contracts", href: "/contracts" },
            { label: contract.title },
          ]}
        />
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <ScrollText className="size-3.5" />
              <Link href={`/vendors/${contract.vendor.id}`} className="hover:underline">
                {contract.vendor.name}
              </Link>
            </span>
          }
          title={contract.title}
          description={`${contract.vendor.category} · owned by ${contract.owner.fullName}`}
          actions={
            canWrite ? (
              <>
                <EditContractButton vendors={vendors} currency={currency} initial={editInitial} />
                {isOpen ? (
                  <ActionButton
                    action={renewContractAction.bind(null, contract.id, 12)}
                    confirmText="Renew this contract for 12 months from the current end date?"
                    successFallback="Contract renewed."
                  >
                    <RefreshCw className="size-4" /> Renew 12 months
                  </ActionButton>
                ) : null}
              </>
            ) : null
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ContractStatusBadge status={contract.displayStatus} />
          {contract.daysToExpiry !== null ? (
            <Badge variant={contract.daysToExpiry < 0 ? "danger" : contract.daysToExpiry <= 90 ? "warning" : "neutral"}>
              {contract.daysToExpiry < 0
                ? `Ended ${Math.abs(contract.daysToExpiry)} days ago`
                : `${contract.daysToExpiry} days to end date`}
            </Badge>
          ) : null}
          <Badge variant="neutral">Currency {currency}</Badge>
        </div>
      </div>

      {contract.displayStatus === "EXPIRED" ? (
        <Alert tone="destructive" title="This contract has passed its end date">
          Renew it, update the terms, or mark it terminated so the register stays accurate.
        </Alert>
      ) : contract.displayStatus === "EXPIRING" ? (
        <Alert tone="warning" title="Renewal window is open">
          {renewalDays !== null && renewalDays >= 0
            ? `${renewalDays} days until the renewal date.`
            : "The renewal date has passed."}{" "}
          Renewing extends the end and renewal dates by 12 months and records the change.
        </Alert>
      ) : contract.displayStatus === "RENEWED" ? (
        <Alert tone="info" title="This agreement was renewed">
          The current record reflects the renewed term. Registered value is unchanged unless you edit the contract.
        </Alert>
      ) : contract.displayStatus === "TERMINATED" ? (
        <Alert tone="info" title="This contract was terminated">
          Renewal warnings are suppressed for terminated agreements.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contract terms</CardTitle>
            <CardDescription>Dates are stored as date-only values; status is recalculated whenever the record is read.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Wallet className="size-3.5" /> Registered value
                </p>
                <p className="mt-1 text-lg font-semibold tabular">{formatMoney(contract.value, currency)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <CalendarRange className="size-3.5" /> Term
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                </p>
                <p className="text-[11px] text-muted-foreground">{totalDays} day term</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <CalendarClock className="size-3.5" /> Renewal date
                </p>
                <p className="mt-1 text-sm font-medium">{formatDate(contract.renewalDate ?? contract.endDate)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {renewalDays === null
                    ? "No renewal date"
                    : renewalDays < 0
                      ? `${Math.abs(renewalDays)} days past`
                      : `${renewalDays} days away`}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <UserRound className="size-3.5" /> Owner
                </p>
                <p className="mt-1 text-sm font-medium">{contract.owner.fullName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{contract.owner.email}</p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Term elapsed</span>
                <span>{Math.round(elapsedPct)}%</span>
              </div>
              <Progress
                value={elapsedPct}
                className="h-2"
                indicatorClassName={elapsedPct > 85 ? "bg-amber-500" : "bg-indigo-500"}
              />
            </div>

            {contract.notes ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">
                  {contract.notes}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document</CardTitle>
              <CardDescription>The signed agreement or latest amendment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.documentName ? (
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <FileText className="size-4 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate">{contract.documentName}</span>
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={`/api/documents/contract/${contract.id}`}
                      target="_blank"
                      rel="noopener"
                      aria-label="Download contract"
                    >
                      <Download className="size-4" />
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No document attached yet.</p>
              )}
              {canWrite ? (
                <div className="border-t pt-3">
                  <UploadPdfForm
                    compact
                    label={contract.documentName ? "Replace PDF" : "Attach PDF"}
                    hint="Replacing keeps one current document; the change is audited."
                    action={uploadContractDocumentAction.bind(null, contract.id)}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href={`/vendors/${contract.vendor.id}`} className="flex items-center gap-2 hover:underline">
                <Building2 className="size-4 text-muted-foreground" />
                {contract.vendor.name}
              </Link>
              <p className="text-xs text-muted-foreground">{contract.vendor.category}</p>
              {canWrite ? (
                <ContractDialog
                  vendors={vendors}
                  currency={currency}
                  initial={editInitial}
                  trigger={
                    <Button variant="outline" size="sm" className="mt-2 w-full">
                      Update terms
                    </Button>
                  }
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
