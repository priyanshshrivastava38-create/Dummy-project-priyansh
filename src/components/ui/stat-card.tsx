import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "indigo" | "emerald" | "amber" | "sky";
  href?: string;
  className?: string;
}) {
  const tones = {
    default: "bg-muted text-muted-foreground",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
  } as const;

  const card = (
    <Card
      className={cn(
        "card-lift h-full p-5",
        href && "transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-50/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular">
            <CountUp value={value} />
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
            tones[tone],
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  );
}
