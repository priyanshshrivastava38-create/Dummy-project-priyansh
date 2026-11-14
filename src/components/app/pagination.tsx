import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function hrefFor(basePath: string, params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  basePath,
  page,
  pages,
  params,
  total,
  noun = "records",
}: {
  basePath: string;
  page: number;
  pages: number;
  params: Record<string, string | undefined>;
  total: number;
  noun?: string;
}) {
  if (pages <= 1) {
    return <p className="text-xs text-muted-foreground">{total} {noun}</p>;
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {pages} · {total} {noun}
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={hrefFor(basePath, params, Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium",
            page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-accent",
          )}
        >
          <ChevronLeft className="size-3.5" /> Previous
        </Link>
        <Link
          href={hrefFor(basePath, params, Math.min(pages, page + 1))}
          aria-disabled={page >= pages}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium",
            page >= pages ? "pointer-events-none opacity-40" : "hover:bg-accent",
          )}
        >
          Next <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
