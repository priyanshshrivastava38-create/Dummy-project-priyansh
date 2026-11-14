import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
        <path d="M5 17V9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 17V5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M19 17v-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
      </svg>
    </div>
  );
}

export function Brand({
  href = "/",
  compact = false,
  inverted = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark
        className={cn(
          "transition-shadow",
          inverted && "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-950/50 ring-1 ring-white/15",
        )}
      />
      {!compact ? (
        <span className={cn("text-[15px] font-semibold tracking-tight", inverted && "text-white")}>
          Ops
          <span className={inverted ? "text-indigo-300/80" : "text-muted-foreground"}>Ledger</span>
        </span>
      ) : null}
    </Link>
  );
}
