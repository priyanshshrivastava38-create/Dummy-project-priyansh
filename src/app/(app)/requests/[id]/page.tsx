import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  CircleDashed,
  Download,
  FilePlus2,
  FileText,
  GitCompareArrows,
  History,
  Pencil,
  Play,
  Send,
  Sparkles,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, canDecideApproval } from "@/lib/permissions";
import { getPurchaseRequest, getRequestFormOptions, requestProgress } from "@/lib/services/requests";
import { advanceRequestAction, deleteRequestAction, submitRequestAction } from "@/app/actions/requests";
import {
  extractQuotationDocumentAction,
  selectQuotationAction,
  uploadQuotationDocumentAction,
} from "@/app/actions/quotations";
import { addCommentAction } from "@/app/actions/requests";
import { uploadRequestDocumentAction } from "@/app/actions/requests";
import { formatDate, formatDateTime, formatMoney, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ComplianceBadge,
  ExtractionStatusBadge,
  PriorityBadge,
  QuotationStatusBadge,
  RequestStatusBadge,
} from "@/components/status-badge";
import { ActionButton } from "@/components/app/action-button";
import { CopyButton } from "@/components/app/copy-button";
import { ApprovalDecision } from "@/components/app/approval-decision";
import { CancelRequestDialog } from "@/components/app/cancel-request-dialog";
import { CommentForm } from "@/components/app/comment-form";
import { UploadPdfForm } from "@/components/app/upload-pdf-form";
import { QuotationDialog } from "@/components/app/quotation-dialog";

export const metadata = { title: "Purchase request" };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const stepTone: Record<string, string> = {
  PENDING: "border-amber-300 bg-amber-50",
  APPROVED: "border-emerald-300 bg-emerald-50",
  REJECTED: "border-red-300 bg-red-50",
  CLARIFICATION_REQUESTED: "border-sky-300 bg-sky-50",
  WAITING: "border-zinc-200 bg-white",
  SKIPPED: "border-zinc-200 bg-zinc-50 opacity-70",
};

const actionLabel: Record<string, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  REQUEST_CLARIFICATION: "Requested clarification",
  COMMENT: "Commented",
  RESUBMIT: "Resubmitted",
  CANCEL: "Cancelled",
};

const actionDot: Record<string, string> = {
  APPROVE: "bg-emerald-500",
  REJECT: "bg-red-500",
  REQUEST_CLARIFICATION: "bg-sky-500",
  COMMENT: "bg-zinc-400",
  RESUBMIT: "bg-indigo-500",
  CANCEL: "bg-zinc-500",
};

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const request = await getPurchaseRequest(user, id);
  if (!request) notFound();

  const [options] = await Promise.all([getRequestFormOptions(user)]);
  const currency = user.currency;
  const canManageQuotes = can(user.role, "quotation:write");
  const canSelectQuote = can(user.role, "quotation:select");
  const canWriteContracts = can(user.role, "contract:write");
  const isOwner = request.requesterId === user.id;
  const hasClarification = request.approvalSteps.some((step) => step.status === "CLARIFICATION_REQUESTED");
  const editable = (["DRAFT", "REJECTED"].includes(request.status) || hasClarification) &&
    (isOwner || user.role === "ADMIN");
  const canSubmit =
    (["DRAFT", "REJECTED"].includes(request.status) || hasClarification) && (isOwner || user.role === "ADMIN");
  const openForQuotes = ["APPROVED", "SOURCING"].includes(request.status);
  const selectedQuotation = request.quotations.find((quote) => quote.status === "SELECTED");
  const activeStep = request.approvalSteps.find((step) => step.status === "PENDING");
  const canDecide =
    activeStep &&
    canDecideApproval({
      role: user.role,
      userId: user.id,
      requesterId: request.requesterId,
      assignedApproverId: activeStep.approverId,
      stepStatus: activeStep.status,
    });
  const canCancel =
    (isOwner || user.role === "ADMIN" || user.role === "PROCUREMENT_MANAGER") &&
    ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "SOURCING"].includes(request.status);
  const itemTotal = request.items.reduce(
    (sum, item) => sum + item.quantity * Number(item.estimatedUnitPrice),
    0,
  );
  const vendorOptions = options.vendors.map((vendor) => ({ id: vendor.id, name: vendor.name }));

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Overview", href: "/dashboard" },
            { label: "Purchase requests", href: "/requests" },
            { label: request.reference },
          ]}
        />
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <span className="font-mono">{request.reference}</span>
              <CopyButton value={request.reference} />
              <span className="text-zinc-300">·</span>
              <span>{request.department.name}</span>
            </span>
          }
          title={request.title}
          description={request.description}
          actions={
            <>
              {request.quotations.length >= 2 ? (
                <Button variant="outline" asChild>
                  <Link href={`/requests/${request.id}/compare`}>
                    <GitCompareArrows className="size-4" /> Compare
                  </Link>
                </Button>
              ) : null}
              {editable ? (
                <Button variant="outline" asChild>
                  <Link href={`/requests/${request.id}/edit`}>
                    <Pencil className="size-4" /> Edit
                  </Link>
                </Button>
              ) : null}
              {canSubmit ? (
                <ActionButton
                  action={submitRequestAction.bind(null, request.id)}
                  successFallback="Submitted for approval."
                >
                  <Send className="size-4" /> Submit for approval
                </ActionButton>
              ) : null}
              {can(user.role, "quotation:write") && request.status === "APPROVED" ? (
                <ActionButton
                  action={advanceRequestAction.bind(null, request.id, "START_SOURCING")}
                  successFallback="Request moved into sourcing."
                >
                  <Play className="size-4" /> Start sourcing
                </ActionButton>
              ) : null}
              {canManageQuotes && request.status === "SOURCING" && selectedQuotation ? (
                <ActionButton
                  action={advanceRequestAction.bind(null, request.id, "COMPLETE")}
                  confirmText="Mark this request complete? Make sure the delivery is confirmed."
                >
                  <Check className="size-4" /> Mark complete
                </ActionButton>
              ) : null}
            </>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={request.status} />
          <PriorityBadge priority={request.priority} />
          <Badge variant="neutral">{request.category}</Badge>
          {request.status === "COMPLETED" ? (
            <Badge variant="success">
              <BadgeCheck className="size-3" /> Completed {formatDate(request.completedAt)}
            </Badge>
          ) : null}
          {selectedQuotation ? (
            <Badge variant="violet">
              <Building2 className="size-3" /> {selectedQuotation.vendor.name}
            </Badge>
          ) : null}
          {canCancel ? <CancelRequestDialog requestId={request.id} reference={request.reference} /> : null}
          {request.status === "DRAFT" && (isOwner || user.role === "ADMIN") ? (
            <ActionButton
              action={deleteRequestAction.bind(null, request.id)}
              confirmText="Delete this draft permanently?"
              redirectTo="/requests"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="size-4" /> Delete draft
            </ActionButton>
          ) : null}
        </div>
      </div>

      {request.status === "REJECTED" && request.rejectionReason ? (
        <Alert tone="destructive" title="This request was rejected">
          {request.rejectionReason} — revise the request and resubmit when ready.
        </Alert>
      ) : null}
      {hasClarification ? (
        <Alert tone="info" title="An approver asked for clarification">
          Review the approval comments below, update the request, then resubmit it to continue routing.
        </Alert>
      ) : null}
      {request.status === "CANCELLED" && request.cancellationReason ? (
        <Alert tone="warning" title="This request was cancelled">
          {request.cancellationReason}
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Request progress</span>
            <span>{requestProgress(request.status)}% through the lifecycle</span>
          </div>
          <Progress value={requestProgress(request.status)} className="mt-2 h-2" />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Created {formatDate(request.createdAt)}</span>
            {request.submittedAt ? <span>Submitted {formatDate(request.submittedAt)}</span> : null}
            {request.approvedAt ? <span>Approved {formatDate(request.approvedAt)}</span> : null}
            {request.completedAt ? <span>Completed {formatDate(request.completedAt)}</span> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle>Line items</CardTitle>
                <CardDescription>What was requested and the estimated cost at time of submission.</CardDescription>
              </div>
              <Badge variant="neutral">{request.items.length} items</Badge>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="hidden sm:table-cell">Unit</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="pr-5 text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-5 font-medium">{item.description}</TableCell>
                      <TableCell className="text-right tabular">{item.quantity}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{item.unit}</TableCell>
                      <TableCell className="text-right tabular">
                        {formatMoney(item.estimatedUnitPrice, currency)}
                      </TableCell>
                      <TableCell className="pr-5 text-right font-medium tabular">
                        {formatMoney(item.quantity * Number(item.estimatedUnitPrice), currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
                <span className="text-muted-foreground">Line items total</span>
                <span className="font-semibold tabular">{formatMoney(itemTotal, currency)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle>Quotations</CardTitle>
                <CardDescription>
                  Recorded vendor offers. Comparison scores are app-calculated; no vendor is awarded automatically.
                </CardDescription>
              </div>
              {canManageQuotes && openForQuotes ? (
                <QuotationDialog
                  requestId={request.id}
                  currency={currency}
                  vendors={vendorOptions}
                  trigger={
                    <Button size="sm" variant="outline">
                      <FilePlus2 className="size-4" /> Add quotation
                    </Button>
                  }
                />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {request.quotations.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
                  <p className="text-sm font-medium">No quotations recorded</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    {openForQuotes
                      ? "Attach a vendor PDF to extract values with AI, or enter a quote manually. Two or more quotes unlock the weighted comparison."
                      : "Quotations can be recorded once this request is approved for sourcing."}
                  </p>
                </div>
              ) : (
                request.quotations.map((quotation) => {
                  const extracted = quotation.extractedData as {
                    warnings?: string[];
                    confidence?: { overall?: number | null } | number | null;
                    deliveryTimeline?: string | null;
                  } | null;
                  const warnings = Array.isArray(extracted?.warnings) ? extracted!.warnings! : [];
                  const extractedConfidence =
                    typeof extracted?.confidence === "number"
                      ? extracted.confidence
                      : extracted?.confidence?.overall ?? null;
                  return (
                    <div
                      key={quotation.id}
                      className={
                        quotation.status === "SELECTED"
                          ? "rounded-xl border border-emerald-200 bg-emerald-50/30 p-4"
                          : "rounded-xl border p-4"
                      }
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{quotation.vendor.name}</p>
                            <QuotationStatusBadge status={quotation.status} />
                            {quotation.vendor.complianceStatus !== "COMPLIANT" ? (
                              <ComplianceBadge status={quotation.vendor.complianceStatus} />
                            ) : null}
                            {quotation.extractionSource !== "MANUAL" ? (
                              <Badge variant="violet">
                                <Sparkles className="size-3" />
                                {quotation.extractionSource === "AI_CORRECTED" ? "AI · corrected" : "AI extracted"}
                              </Badge>
                            ) : (
                              <Badge variant="neutral">Manual</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Recorded {formatDate(quotation.createdAt)}
                            {quotation.extractionModel ? ` · ${quotation.extractionModel}` : ""}
                            {quotation.extractionSource !== "MANUAL" && extractedConfidence !== null
                              ? ` · ${extractedConfidence}% field confidence`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold tabular">{formatMoney(quotation.totalAmount, currency)}</p>
                          <p className="text-[11px] text-muted-foreground">Quoted total</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Delivery</p>
                          <p className="font-medium">
                            {quotation.deliveryDays === null ? "—" : `${quotation.deliveryDays} days`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payment</p>
                          <p className="font-medium">{quotation.paymentTerms ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Warranty</p>
                          <p className="font-medium">
                            {quotation.warrantyMonths === null ? "—" : `${quotation.warrantyMonths} mo`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valid until</p>
                          <p className="font-medium">{formatDate(quotation.validityDate)}</p>
                        </div>
                      </div>

                      {quotation.items.length ? (
                        <div className="mt-3 rounded-lg border bg-white/60">
                          {quotation.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 border-b px-3 py-1.5 text-xs last:border-0"
                            >
                              <span className="truncate">{item.description}</span>
                              <span className="shrink-0 tabular text-muted-foreground">
                                {item.quantity} × {formatMoney(item.unitPrice, currency)} ={" "}
                                <span className="font-medium text-foreground">{formatMoney(item.total, currency)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {quotation.notes ? (
                        <p className="mt-2 text-xs text-muted-foreground">Vendor note: {quotation.notes}</p>
                      ) : null}

                      {warnings.length > 0 ? (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {warnings.map((warning) => (
                            <p key={warning}>• {warning}</p>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {quotation.documents.map((document) => (
                            <div
                              key={document.id}
                              className="flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs"
                            >
                              <FileText className="size-3.5 text-zinc-400" />
                              <a
                                href={`/api/documents/quotation/${document.id}`}
                                target="_blank"
                                rel="noopener"
                                className="max-w-[150px] truncate hover:underline"
                              >
                                {document.fileName}
                              </a>
                              <ExtractionStatusBadge status={document.extractionStatus} />
                              <a
                                href={`/api/documents/quotation/${document.id}`}
                                target="_blank"
                                rel="noopener"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Open PDF"
                              >
                                <Download className="size-3.5" />
                              </a>
                            </div>
                          ))}
                          {canManageQuotes && openForQuotes ? (
                            <QuotationDialog
                              requestId={request.id}
                              currency={currency}
                              vendors={vendorOptions}
                              initial={{
                                id: quotation.id,
                                vendorId: quotation.vendorId,
                                taxAmount: quotation.taxAmount ? Number(quotation.taxAmount) : null,
                                additionalCharges: quotation.additionalCharges
                                  ? Number(quotation.additionalCharges)
                                  : null,
                                totalAmount: quotation.totalAmount ? Number(quotation.totalAmount) : null,
                                deliveryDays: quotation.deliveryDays,
                                paymentTerms: quotation.paymentTerms,
                                warrantyMonths: quotation.warrantyMonths,
                                validityDate: quotation.validityDate
                                  ? quotation.validityDate.toISOString().slice(0, 10)
                                  : null,
                                notes: quotation.notes,
                                items: quotation.items.map((item) => ({
                                  description: item.description,
                                  quantity: item.quantity,
                                  unitPrice: Number(item.unitPrice),
                                })),
                              }}
                              trigger={
                                <Button size="sm" variant="ghost">
                                  <Pencil className="size-3.5" /> Correct fields
                                </Button>
                              }
                            />
                          ) : null}
                          {quotation.documents.map((document) =>
                            canManageQuotes && openForQuotes && document.extractionStatus !== "EXTRACTED" ? (
                              <ActionButton
                                key={`extract-${document.id}`}
                                size="sm"
                                variant="outline"
                                action={extractQuotationDocumentAction.bind(null, document.id, request.id)}
                                successFallback="Extraction finished."
                              >
                                <Sparkles className="size-3.5" /> Extract PDF
                              </ActionButton>
                            ) : null,
                          )}
                        </div>

                        <div className="sm:ml-auto flex items-center gap-2">
                          {canManageQuotes && openForQuotes ? (
                            <UploadPdfForm
                              compact
                              hint="Attach the original PDF — kept even if extraction fails."
                              label="Attach PDF"
                              action={uploadQuotationDocumentAction.bind(null, quotation.id, request.id)}
                            />
                          ) : null}
                          {canSelectQuote && openForQuotes && quotation.status !== "SELECTED" ? (
                            <ActionButton
                              size="sm"
                              action={selectQuotationAction.bind(null, quotation.id, request.id)}
                              confirmText={`Record ${quotation.vendor.name} as the selected vendor for this request?`}
                              successFallback="Vendor decision recorded."
                            >
                              <Target className="size-3.5" /> Select vendor
                            </ActionButton>
                          ) : null}
                          {quotation.status === "SELECTED" ? (
                            <Badge variant="success">
                              <Check className="size-3" /> Selected vendor
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {request.quotations.length >= 2 ? (
                <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                  <Link href={`/requests/${request.id}/compare`}>
                    Open weighted comparison <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval trail</CardTitle>
              <CardDescription>
                Server-enforced routing. Nobody can approve their own request, and every decision is logged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {request.approvalSteps.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
                  <p className="text-sm font-medium">Approval routing starts on submission</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    The chain is built from active spend policies and your department. Segregation of duties prevents
                    self-approval.
                  </p>
                </div>
              ) : (
                <ol className="space-y-2.5">
                  {request.approvalSteps.map((step) => (
                    <li
                      key={step.id}
                      className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${stepTone[step.status] ?? ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-white text-xs font-semibold">
                          L{step.level}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {step.approver.fullName}
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              {titleCase(step.approver.role)}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {step.activatedAt ? `Activated ${formatDate(step.activatedAt)}` : "Waiting for prior level"}
                            {step.decidedAt ? ` · Decided ${formatDate(step.decidedAt)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <Badge
                          variant={
                            step.status === "APPROVED"
                              ? "success"
                              : step.status === "REJECTED"
                                ? "danger"
                                : step.status === "PENDING"
                                  ? "warning"
                                  : step.status === "CLARIFICATION_REQUESTED"
                                    ? "info"
                                    : "neutral"
                          }
                        >
                          {titleCase(step.status)}
                        </Badge>
                        {canDecide && activeStep?.id === step.id ? (
                          <ApprovalDecision
                            compact
                            stepId={step.id}
                            reference={request.reference}
                            level={step.level}
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {request.approvalActions.length > 0 ? (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    {request.approvalActions
                      .slice()
                      .reverse()
                      .map((action) => (
                        <div key={action.id} className="flex gap-2.5">
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${actionDot[action.action] ?? "bg-zinc-400"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">
                              <span className="font-medium">{action.actor.fullName}</span>{" "}
                              <span className="text-muted-foreground">{actionLabel[action.action] ?? titleCase(action.action)}</span>
                              <span className="ml-1.5 text-[11px] text-muted-foreground">
                                {formatDateTime(action.createdAt)}
                              </span>
                            </p>
                            {action.comment ? (
                              <p className="mt-0.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-zinc-700">
                                {action.comment}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              ) : null}

              <Separator className="my-4" />
              <CommentForm action={addCommentAction.bind(null, request.id)} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="size-4" /> Estimated budget
                </span>
                <span className="font-semibold tabular">{formatMoney(request.estimatedBudget, currency)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Line item total</span>
                <span className="tabular">{formatMoney(itemTotal, currency)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="size-4" /> Required by
                </span>
                <span>{formatDate(request.requiredBy)}</span>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Requester</span>
                <span className="text-right">
                  <span className="block font-medium">{request.requester.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{request.requester.email}</span>
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Department</span>
                <span className="text-right">
                  <span className="block font-medium">{request.department.name}</span>
                  {request.department.annualBudget ? (
                    <span className="block text-xs text-muted-foreground">
                      {formatMoney(request.department.annualBudget, currency, { compact: true })} annual budget
                    </span>
                  ) : null}
                </span>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Selected vendor</span>
                <span className="text-right font-medium">
                  {request.recommendedVendor?.name ?? "Not decided"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Quotations</span>
                <span className="font-medium">{request.quotations.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle>Documents</CardTitle>
                <CardDescription>Original quote PDFs and supporting files.</CardDescription>
              </div>
              <FileText className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              {request.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No request documents attached yet.</p>
              ) : (
                <ul className="space-y-2">
                  {request.documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-2 text-sm">
                      <FileText className="size-4 shrink-0 text-zinc-400" />
                      <a
                        href={`/api/documents/request/${document.id}`}
                        target="_blank"
                        rel="noopener"
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {document.fileName}
                      </a>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatBytes(document.sizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!["CANCELLED", "COMPLETED"].includes(request.status) &&
              (isOwner || user.role === "ADMIN" || user.role === "PROCUREMENT_MANAGER") ? (
                <div className="border-t pt-3">
                  <UploadPdfForm
                    compact
                    label="Attach PDF"
                    hint="Spec sheets, requirements or approvals."
                    action={uploadRequestDocumentAction.bind(null, request.id)}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" /> Activity
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" asChild>
                <Link href="/analytics">
                  Analytics <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {request.activities.map((activity) => (
                  <li key={activity.id} className="flex gap-2.5 text-xs">
                    <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-zinc-300" />
                    <div>
                      <p className="leading-snug text-zinc-700">{activity.summary}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {activity.actor.fullName} · {formatDateTime(activity.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {request.status === "APPROVED" && canManageQuotes ? (
            <Alert tone="info" title="Ready for sourcing">
              Start sourcing to record vendor quotations, then use the weighted comparison to make a transparent
              decision. Selection stays a human action.
            </Alert>
          ) : null}
          {request.status === "SOURCING" && !selectedQuotation ? (
            <Alert tone="warning" title="No vendor selected yet">
              Record quotations and select a vendor before marking this request complete. The comparison explains the
              trade-offs, but the award decision is recorded by procurement.
            </Alert>
          ) : null}
          {request.status === "DRAFT" ? (
            <Alert tone="info" title="Draft request">
              Add at least one line item and submit for approval. The approval chain is generated from the estimated
              budget.
            </Alert>
          ) : null}
          {request.status === "COMPLETED" && selectedQuotation ? (
            <Alert tone="success" title="Completed and awarded">
              {selectedQuotation.vendor.name} was selected for {formatMoney(selectedQuotation.totalAmount, currency)}.
              {canWriteContracts
                ? " Create a contract to track renewal obligations."
                : " Procurement can link a contract for renewals."}
            </Alert>
          ) : null}
          {request.status === "REJECTED" ? (
            <Alert tone="destructive" title="Needs revision">
              Only the requester or an administrator can edit and resubmit a rejected request.
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}
