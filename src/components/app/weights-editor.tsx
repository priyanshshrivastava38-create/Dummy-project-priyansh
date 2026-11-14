"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveWeightsAction } from "@/app/actions/comparison";
import { updateDefaultWeightsAction } from "@/app/actions/settings";
import { CRITERION_META, DEFAULT_WEIGHTS, type CriterionKey } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

const KEYS = Object.keys(DEFAULT_WEIGHTS) as CriterionKey[];

export function WeightsEditor({
  initial,
  requestId,
  mode = "request",
  sourceLabel,
  compact = false,
}: {
  initial: Record<CriterionKey, number>;
  requestId?: string;
  mode?: "request" | "default";
  sourceLabel?: string;
  compact?: boolean;
}) {
  const [weights, setWeights] = useState<Record<CriterionKey, number>>({ ...initial });
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const total = useMemo(() => Math.round(KEYS.reduce((sum, key) => sum + (weights[key] || 0), 0) * 10) / 10, [weights]);
  const valid = Math.abs(total - 100) < 0.01;

  const set = (key: CriterionKey, value: string) => {
    setWeights((current) => ({ ...current, [key]: Number(value) || 0 }));
  };

  const applyPreview = () => {
    if (!valid) {
      toast.error("Weights must add up to 100%.");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    KEYS.forEach((key) => params.set(`w_${key}`, String(weights[key])));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const save = () => {
    if (!valid) {
      toast.error("Weights must add up to 100%.");
      return;
    }
    startTransition(async () => {
      const result =
        mode === "request" && requestId
          ? await saveWeightsAction(requestId, weights)
          : await updateDefaultWeightsAction(weights);
      if (result.ok) {
        toast.success(result.success ?? "Weights saved.");
        const params = new URLSearchParams(window.location.search);
        KEYS.forEach((key) => params.delete(`w_${key}`));
        router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
        router.refresh();
      } else {
        toast.error(result.error ?? "Weights could not be saved.");
      }
    });
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Scoring weights
          </p>
          {sourceLabel ? <p className="text-[11px] text-muted-foreground">{sourceLabel}</p> : null}
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-medium tabular",
            valid
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {total}% / 100%
        </span>
      </div>
      <div className={cn("grid gap-2", compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-5")}>
        {KEYS.map((key) => (
          <div key={key} className="space-y-1">
            <label htmlFor={`w-${key}`} className="text-[11px] font-medium text-muted-foreground">
              {CRITERION_META[key].label}
            </label>
            <div className="relative">
              <Input
                id={`w-${key}`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={weights[key]}
                onChange={(event) => set(key, event.target.value)}
                className="h-8 pr-6 text-sm tabular"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                %
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mode === "request" ? (
          <Button type="button" size="sm" variant="outline" onClick={applyPreview} disabled={!valid}>
            Recalculate ranking
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={save} disabled={!valid || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Save weights
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
        >
          <RotateCcw /> Reset defaults
        </Button>
      </div>
      {mode === "request" ? (
        <p className="text-[11px] text-muted-foreground">
          “Recalculate” previews the ranking without saving. “Save” stores these weights on this request.
          Missing criteria are excluded and the remaining weights are renormalised — values are never assumed.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          These defaults apply to new requests that do not set their own weights.
        </p>
      )}
    </div>
  );
}
