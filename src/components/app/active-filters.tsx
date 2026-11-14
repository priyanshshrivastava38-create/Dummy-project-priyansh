import Link from "next/link";
import { X } from "lucide-react";

export type ActiveFilter = {
  key: string;
  label: string;
  value?: string;
  display?: string;
};

export function ActiveFilters({
  basePath,
  params,
  filters,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  filters: ActiveFilter[];
}) {
  const active = filters.filter((filter) => Boolean(filter.value));
  if (active.length === 0) return null;

  const hrefWithout = (omit?: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (!value || key === omit || key === "page") continue;
      query.set(key, value);
    }
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <div role="group" aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filtered by</span>
      {active.map((filter) => (
        <Link
          key={filter.key}
          href={hrefWithout(filter.key)}
          className="group/chip inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/70 py-1 pl-2.5 pr-1.5 text-xs font-medium text-indigo-800 transition-all hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">{filter.label}</span>
          <span className="max-w-[220px] truncate">{filter.display ?? filter.value}</span>
          <span
            aria-hidden
            className="flex size-4 items-center justify-center rounded-full bg-white/80 text-indigo-600 transition-colors group-hover/chip:bg-white group-hover/chip:text-indigo-800"
          >
            <X className="size-2.5" />
          </span>
          <span className="sr-only">Remove {filter.label} filter</span>
        </Link>
      ))}
      {active.length > 1 ? (
        <Link
          href={basePath}
          className="text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Clear all
        </Link>
      ) : null}
    </div>
  );
}
