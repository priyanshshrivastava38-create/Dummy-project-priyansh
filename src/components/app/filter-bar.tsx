"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SelectConfig = {
  name: string;
  label: string;
  value?: string;
  allLabel?: string;
  allValue?: string;
  options: { value: string; label: string }[];
};

export function FilterBar({
  searchPlaceholder = "Search…",
  searchValue,
  selects,
  children,
  className,
}: {
  searchPlaceholder?: string;
  searchValue?: string;
  selects: SelectConfig[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      method="get"
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={searchValue ?? ""}
          placeholder={searchPlaceholder}
          className="h-9 pl-9"
          aria-label={searchPlaceholder}
        />
      </div>
      {selects.map((select) => (
        <Select
          key={select.name}
          name={select.name}
          defaultValue={select.value ?? select.allValue ?? "ALL"}
          aria-label={select.label}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="sm:w-auto"
        >
          <option value={select.allValue ?? "ALL"}>{select.allLabel ?? `All ${select.label.toLowerCase()}`}</option>
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ))}
      {children}
    </form>
  );
}
