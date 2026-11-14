import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = { title: "Vendor" };
import {
  Building2,
  CalendarClock,
  FileText,
  Mail,
  Phone,
  ScrollText,
  Star,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getVendor } from "@/lib/services/vendors";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComplianceBadge, ContractStatusBadge, QuotationStatusBadge, RequestStatusBadge } from "@/components/status-badge";
import { EvaluateVendorDialog, VendorFormDialog } from "@/components/app/vendor-dialogs";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const vendor = await getVendor(user, id);
  if (!vendor) notFound();

  const canWrite = can(user.role, "vendor:write");
  const latestEvaluation = vendor.evaluations[0];

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Overview", href: "/dashboard" },
            { label: "Vendors", href: "/vendors" },
            { label: vendor.name },
          ]}
        />
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <Building2 className="size-3.5" />
              {vendor.category}
            </span>
          }
          title={vendor.name}
          description={`Vendor since ${formatDate(vendor.createdAt)} · ${vendor.quotations.length} quotation${vendor.quotations.length === 1 ? "" : "s"} recorded`}
          actions={
            canWrite ? (
              <>
                <EvaluateVendorDialog
                  vendorId={vendor.id}
                  vendorName={vendor.name}
                  initial={
                    latestEvaluation
                      ? {
                          qualityScore: latestEvaluation.qualityScore,
                          deliveryScore: latestEvaluation.deliveryScore,
                          complianceScore: latestEvaluation.complianceScore,
                        }
                      : undefined
                  }
                />
                <VendorFormDialog
                  initial={{
                    id: vendor.id,
                    name: vendor.name,
                    contactName: vendor.contactName,
                    email: vendor.email,
                    phone: vendor.phone ?? "",
                    category: vendor.category,
                    taxId: vendor.taxId ?? "",
                    status: vendor.status,
                    complianceStatus: vendor.complianceStatus,
                    performanceRating: vendor.performanceRating,
                    deliveryReliability: vendor.deliveryReliability,
                    notes: vendor.notes ?? "",
                  }}
                  trigger={<Button size="sm">Edit vendor</Button>}
                />
              </>
            ) : null
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={vendor.status === "ACTIVE" ? "success" : "neutral"}>
            {vendor.status === "ACTIVE" ? "Active" : "Inactive"}
          </Badge>
          <ComplianceBadge status={vendor.complianceStatus} />
          {vendor.taxId ? <Badge variant="neutral">Tax ID {vendor.taxId}</Badge> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Awarded value"
          value={formatMoney(vendor.awardedValue, user.currency, { compact: vendor.awardedValue > 999_999 })}
          hint="Selected quotations"
          icon={Wallet}
          tone="emerald"
        />
        <StatCard
          label="Active contracts"
          value={String(vendor.activeContracts.length)}
          hint={`${formatMoney(vendor.contractValue, user.currency, { compact: true })} contract value`}
          icon={ScrollText}
          tone="indigo"
        />
        <StatCard
          label="Performance rating"
          value={vendor.performanceRating === null ? "—" : `${vendor.performanceRating}/100`}
          hint={`${vendor.evaluations.length} evaluation${vendor.evaluations.length === 1 ? "" : "s"}`}
          icon={Star}
          tone="amber"
        />
        <StatCard
          label="Delivery reliability"
          value={vendor.deliveryReliability === null ? "—" : `${vendor.deliveryReliability}/100`}
          hint="Feeds quotation scoring"
          icon={CalendarClock}
          tone="sky"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Contact & notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{vendor.contactName}</p>
              <p className="text-xs text-muted-foreground">Primary contact</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="size-4 text-muted-foreground" />
              <a href={`mailto:${vendor.email}`} className="hover:underline">
                {vendor.email}
              </a>
            </div>
            {vendor.phone ? (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" />
                <span>{vendor.phone}</span>
              </div>
            ) : null}
            {vendor.notes ? (
              <p className="rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-zinc-700">{vendor.notes}</p>
            ) : (
              <p className="text-xs text-muted-foreground">No internal notes recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quotation history</CardTitle>
            <CardDescription>Every offer recorded from this vendor, latest first.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {vendor.quotations.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No quotations recorded"
                description="Add this vendor while sourcing an approved request to build their history."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Request</TableHead>
                    <TableHead>Quote status</TableHead>
                    <TableHead className="hidden sm:table-cell">Request status</TableHead>
                    <TableHead className="pr-5 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendor.quotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="pl-5">
                        <Link href={`/requests/${quotation.request.id}`} className="block hover:text-indigo-700">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {quotation.request.reference}
                          </span>
                          <span className="block truncate text-sm font-medium">{quotation.request.title}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {quotation.request.department?.name ?? "—"} · {formatDate(quotation.createdAt)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <QuotationStatusBadge status={quotation.status} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <RequestStatusBadge status={quotation.request.status} />
                      </TableCell>
                      <TableCell className="pr-5 text-right text-sm font-medium tabular">
                        {formatMoney(quotation.totalAmount, user.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contracts</CardTitle>
            <CardDescription>Active and historical agreements with renewal dates.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {vendor.contracts.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No contracts linked"
                description="Create a contract from the Contracts module to track renewals and risk."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/contracts">Open contracts</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {vendor.contracts.map((contract) => (
                  <li key={contract.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/contracts/${contract.id}`} className="block truncate text-sm font-medium hover:text-indigo-700">
                        {contract.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        Ends {formatDate(contract.endDate)} · renew {formatDate(contract.renewalDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs tabular text-muted-foreground">
                        {formatMoney(contract.value, user.currency, { compact: true })}
                      </span>
                      <ContractStatusBadge status={contract.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluations</CardTitle>
            <CardDescription>Structured feedback updates the vendor&apos;s ratings.</CardDescription>
          </CardHeader>
          <CardContent>
            {vendor.evaluations.length === 0 ? (
              <EmptyState
                icon={Star}
                title="No evaluations yet"
                description="Record a quality, delivery and compliance score after an engagement."
              />
            ) : (
              <ul className="space-y-3">
                {vendor.evaluations.map((evaluation) => (
                  <li key={evaluation.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{evaluation.evaluator.fullName}</p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <Badge variant="neutral">Q {evaluation.qualityScore}</Badge>
                        <Badge variant="neutral">D {evaluation.deliveryScore}</Badge>
                        <Badge variant="neutral">C {evaluation.complianceScore}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(evaluation.createdAt)}
                      {evaluation.request ? (
                        <>
                          {" · "}
                          <Link href={`/requests/${evaluation.request.id}`} className="hover:underline">
                            {evaluation.request.reference}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {evaluation.comment ? (
                      <p className="mt-1.5 text-xs text-zinc-700">{evaluation.comment}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {vendor.recommendedRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Selected for</CardTitle>
            <CardDescription>Requests where this vendor was recorded as the award decision.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {vendor.recommendedRequests.map((request) => (
              <Link
                key={request.id}
                href={`/requests/${request.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] text-muted-foreground">{request.reference}</span>
                  <span className="block truncate font-medium">{request.title}</span>
                </span>
                <RequestStatusBadge status={request.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
