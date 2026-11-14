import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Check,
  CircleSlash,
  Info,
  Scale,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadComparison } from "@/lib/services/comparison";
import { getAiStatus } from "@/lib/ai/provider";
import { selectQuotationAction } from "@/app/actions/quotations";
import { formatMoney, titleCase } from "@/lib/utils";
import { CRITERION_META, type CriterionKey, type ScoringWeights } from "@/lib/scoring/engine";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { QuotationStatusBadge, RequestStatusBadge } from "@/components/status-badge";
import { WeightsEditor } from "@/components/app/weights-editor";
import { AiSummary } from "@/components/app/ai-summary";
import { ActionButton } from "@/components/app/action-button";

export const metadata = { title: "Vendor comparison" };

const WEIGHT_KEYS = Object.keys(CRITERION_META) as CriterionKey[];

function parseOverride(params: Record<string, string | undefined>): ScoringWeights | undefined {
  const keysPresent = WEIGHT_KEYS.filter((key) => params[`w_${key}`] !== undefined);
  if (!keysPresent.length) return undefined;
  const weights = {} as ScoringWeights;
  for (const key of WEIGHT_KEYS) {
    const value = Number(params[`w_${key}`]);
    if (!Number.isFinite(value)) return undefined;
    weights[key] = value;
  }
  return weights;
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const override = parseOverride(query);
  const data = await loadComparison(user, id, override);
  if (!data) notFound();

  const { request, comparison, weights, weightsSource, currency } = data;
  const ai = getAiStatus();
  const canSelect = can(user.role, "quotation:select");
  const canManageWeights = can(user.role, "quotation:select");
  const selectedId = request.quotations.find((quote) => quote.status === "SELECTED")?.id ?? null;
  const openForSelection = ["APPROVED", "SOURCING"].includes(request.status);
  const scores = [...comparison.scores].sort((a, b) => {
    if (a.rank === null && b.rank === null) return (a.totalAmount ?? Infinity) - (b.totalAmount ?? Infinity);
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  });
  const missingQuotes = request.quotations.length < 2;

  const sourceLabel =
    weightsSource === "custom"
      ? "Preview only — these weights are not saved yet"
      : weightsSource === "request"
        ? "Saved on this request"
        : "Using the organisation default weights";

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Purchase requests", href: "/requests" },
            { label: request.reference, href: `/requests/${request.id}` },
            { label: "Compare vendors" },
          ]}
        />
        <PageHeader
          eyebrow="Module E · Vendor comparison"
          title="Weighted vendor comparison"
          description={`${request.title} · estimated budget ${formatMoney(request.estimatedBudget, currency)} · ${request.department.name}`}
          actions={
            <>
              <RequestStatusBadge status={request.status} />
              <Button variant="outline" asChild>
                <Link href={`/requests/${request.id}`}>Request detail</Link>
              </Button>
            </>
          }
        />
      </div>

      <Alert tone="info" title="Scores are calculated by the app, not by AI">
        Each criterion is scored from stored quotation and vendor data using the formulas shown below. Missing values are
        excluded and the remaining weights are renormalised — the app never invents a number. The AI summary can explain
        the result, but it cannot change scores or award a vendor.
      </Alert>

      {missingQuotes ? (
        <Card>
          <EmptyState
            icon={Scale}
            title={request.quotations.length === 1 ? "Add at least one more quotation" : "No quotations to compare"}
            description={
              request.quotations.length === 1
                ? "One quote can be scored, but a comparison needs a second vendor to put the trade-offs in context."
                : "Record vendor quotations from the request detail page, then return here to compare them."
            }
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href={`/requests/${request.id}`}>Back to quotations</Link>
              </Button>
            }
          />
        </Card>
      ) : null}

      {comparison.leader && !missingQuotes ? (
        <Card className="overflow-hidden border-indigo-200/70">
          <div className="bg-gradient-to-r from-indigo-50 via-violet-50/60 to-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                  <Trophy className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
                    Highest weighted score · not an automatic award
                  </p>
                  <p className="mt-1 text-lg font-semibold">{comparison.leader.vendorName}</p>
                  <p className="text-sm text-muted-foreground">
                    {comparison.leader.overall?.toFixed(1)} / 100 at the current weights ·{" "}
                    {formatMoney(comparison.leader.totalAmount, currency)}
                    {comparison.leader.costPremiumPct !== null && comparison.leader.costPremiumPct > 0
                      ? ` · ${comparison.leader.costPremiumPct.toFixed(1)}% above the lowest quote`
                      : comparison.leader.costPremiumPct === 0
                        ? " · lowest quoted cost"
                        : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant="violet">
                  <Sparkles className="size-3" /> AI summary is explain-only
                </Badge>
                {canSelect && openForSelection && comparison.leader.quotationId !== selectedId ? (
                  <ActionButton
                    size="sm"
                    action={selectQuotationAction.bind(null, comparison.leader.quotationId, request.id)}
                    confirmText={`Record ${comparison.leader.vendorName} as the selected vendor? This is a human decision stored in the audit trail.`}
                  >
                    <Target className="size-4" /> Select this vendor
                  </ActionButton>
                ) : null}
                {comparison.leader.quotationId === selectedId ? (
                  <Badge variant="success">
                    <Check className="size-3" /> Award recorded
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="size-4 text-indigo-500" /> Weighting
            </CardTitle>
            <CardDescription>{sourceLabel}.</CardDescription>
          </CardHeader>
          <CardContent>
            {canManageWeights ? (
              <WeightsEditor
                initial={weights}
                requestId={request.id}
                mode="request"
                sourceLabel={
                  weightsSource === "custom"
                    ? "Previewing unsaved values — save to persist, or reset to discard."
                    : weightsSource === "request"
                      ? "Saved weights for this request."
                      : "Organisation defaults until you save request weights."
                }
              />
            ) : (
              <div className="space-y-2">
                {WEIGHT_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{CRITERION_META[key].label}</span>
                    <span className="font-medium tabular">{weights[key]}%</span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Weights are set by procurement. They are shown here so the result is fully reproducible.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ranking at {WEIGHT_KEYS.map((key) => `${weights[key]}%`).join(" / ")}</CardTitle>
            <CardDescription>
              Overall score is the weighted average of available criteria, rescaled when data is missing.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium">Rank</th>
                    <th className="px-3 py-2 text-left font-medium">Vendor</th>
                    <th className="px-3 py-2 text-right font-medium">Quoted total</th>
                    <th className="px-3 py-2 text-right font-medium">vs lowest</th>
                    <th className="px-3 py-2 text-right font-medium">Score</th>
                    <th className="px-5 py-2 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score) => (
                    <tr key={score.quotationId} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        {score.rank ? (
                          <span
                            className={
                              score.rank === 1
                                ? "inline-flex size-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
                                : "inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold text-zinc-600"
                            }
                          >
                            {score.rank}
                          </span>
                        ) : (
                          <CircleSlash className="size-4 text-zinc-300" />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{score.vendorName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {score.deliveryDays !== null ? `${score.deliveryDays} day delivery` : "Delivery missing"}
                          {score.paymentTerms ? ` · ${score.paymentTerms}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular">
                        {formatMoney(score.totalAmount, currency)}
                      </td>
                      <td className="px-3 py-3 text-right tabular text-muted-foreground">
                        {score.costDelta === null
                          ? "—"
                          : score.costDelta === 0
                            ? <span className="text-emerald-600">Lowest</span>
                            : `+${formatMoney(score.costDelta, currency)}`}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-semibold tabular">
                          {score.overall === null ? "—" : score.overall.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={
                            score.completeness >= 85
                              ? "text-xs font-medium text-emerald-600"
                              : score.completeness >= 55
                                ? "text-xs font-medium text-amber-600"
                                : "text-xs font-medium text-red-600"
                          }
                        >
                          {score.completeness}% data
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {comparison.excludedCriteria.length > 0 ? (
              <div className="border-t px-5 py-3">
                <p className="flex items-start gap-2 text-xs text-amber-700">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {comparison.excludedCriteria
                    .map((key) => CRITERION_META[key].label)
                    .join(", ")}{" "}
                  {comparison.excludedCriteria.length === 1 ? "is" : "are"} missing from every quotation, so{" "}
                  {comparison.excludedCriteria.length === 1 ? "it was" : "they were"} excluded and the remaining weights
                  renormalised.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {scores.map((score) => {
          const quotation = request.quotations.find((quote) => quote.id === score.quotationId);
          return (
            <Card key={score.quotationId} className={score.rank === 1 ? "border-indigo-200" : undefined}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {score.vendorName}
                    {score.rank ? <Badge variant={score.rank === 1 ? "violet" : "neutral"}>Rank {score.rank}</Badge> : null}
                    {quotation ? <QuotationStatusBadge status={quotation.status} /> : null}
                  </CardTitle>
                  <CardDescription>
                    {formatMoney(score.totalAmount, currency)} ·{" "}
                    {score.deliveryDays !== null ? `${score.deliveryDays} days` : "delivery unknown"} ·{" "}
                    {score.warrantyMonths !== null ? `${score.warrantyMonths} mo warranty` : "warranty unknown"}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular">
                    {score.overall === null ? "—" : score.overall.toFixed(1)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Weighted score</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5">
                  {score.criteria.map((criterion) => (
                    <div key={criterion.key} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          {criterion.label}
                          <span className="font-normal text-muted-foreground">{criterion.weight}%</span>
                        </span>
                        <span className="tabular text-muted-foreground">
                          {criterion.missing
                            ? "missing"
                            : `${criterion.score} → ${criterion.weighted} pts`}
                        </span>
                      </div>
                      <Progress
                        value={criterion.score ?? 0}
                        className="h-1.5"
                        indicatorClassName={
                          criterion.missing
                            ? "bg-zinc-200"
                            : (criterion.score ?? 0) >= 85
                              ? "bg-emerald-500"
                              : (criterion.score ?? 0) >= 55
                                ? "bg-indigo-500"
                                : "bg-amber-500"
                        }
                      />
                      <p className="text-[10px] leading-snug text-muted-foreground">{criterion.detail}</p>
                    </div>
                  ))}
                </div>

                {score.strengths.length || score.weaknesses.length ? (
                  <div className="space-y-1.5 border-t pt-3 text-xs">
                    {score.strengths.length ? (
                      <p className="text-emerald-700">
                        <span className="font-medium">Strengths:</span> {score.strengths.join(" · ")}
                      </p>
                    ) : null}
                    {score.weaknesses.length ? (
                      <p className="text-amber-700">
                        <span className="font-medium">Watch-outs:</span> {score.weaknesses.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {score.missingLabels.length ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Missing information: {score.missingLabels.join(", ")}. These criteria were excluded from this
                    vendor&apos;s score — correct the quotation fields if the vendor did provide them.
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {titleCase(quotation?.extractionSource ?? "MANUAL")}
                    {quotation?.extractionConfidence !== null && quotation?.extractionConfidence !== undefined
                      ? ` · ${quotation.extractionConfidence}% extraction confidence`
                      : ""}
                  </span>
                  {canSelect && openForSelection && quotation ? (
                    quotation.status === "SELECTED" ? (
                      <Badge variant="success">
                        <Check className="size-3" /> Award recorded
                      </Badge>
                    ) : (
                      <ActionButton
                        size="sm"
                        variant="outline"
                        action={selectQuotationAction.bind(null, quotation.id, request.id)}
                        confirmText={`Record ${score.vendorName} as the selected vendor?`}
                      >
                        <Target className="size-4" /> Select
                      </ActionButton>
                    )
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!missingQuotes ? (
        <Card>
          <CardHeader>
            <CardTitle>How each criterion is scored</CardTitle>
            <CardDescription>These formulas are deterministic and use only stored data.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium">Price</p>
              <p className="mt-1 text-muted-foreground">lowest ÷ this quote × 100</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium">Delivery</p>
              <p className="mt-1 text-muted-foreground">fastest lead time ÷ this lead time × 100</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium">Quality</p>
              <p className="mt-1 text-muted-foreground">70% warranty (24 mo = 100) + 30% compliance</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium">Reliability</p>
              <p className="mt-1 text-muted-foreground">vendor delivery reliability, rating fallback</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium">Payment</p>
              <p className="mt-1 text-muted-foreground">min(100, 40 + net days); upfront scores 10</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400"
        />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/25">
              <Sparkles className="size-3.5" />
            </span>
            AI narrative summary
          </CardTitle>
          <CardDescription>
            {ai.available
              ? "A written explanation of the calculated trade-offs. It cannot change scores or make the award."
              : "No AI provider is configured. Every score, weight and ranking above remains fully available."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiSummary requestId={request.id} weights={weights} />
        </CardContent>
      </Card>
    </div>
  );
}
