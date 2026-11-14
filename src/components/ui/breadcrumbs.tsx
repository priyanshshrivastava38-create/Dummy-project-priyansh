import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumbs({
  items,
  className,
}: {
  items: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground", className)}
    >
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3 shrink-0 text-zinc-300" aria-hidden /> : null}
          {item.href ? (
            <Link
              href={item.href}
              className="truncate rounded-sm underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate font-medium text-foreground">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
