import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: {
    className: "border-sky-200 bg-sky-50 text-sky-900",
    icon: Info,
    iconClass: "text-sky-600",
  },
  success: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
  },
  warning: {
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
  },
  destructive: {
    className: "border-red-200 bg-red-50 text-red-900",
    icon: ShieldAlert,
    iconClass: "text-red-600",
  },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const config = tones[tone];
  const Icon = config.icon;
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3.5 text-sm", config.className, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", config.iconClass)} />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="leading-relaxed opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}
