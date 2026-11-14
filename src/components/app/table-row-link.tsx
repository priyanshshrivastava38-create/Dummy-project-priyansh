"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TableRowLink({
  href,
  children,
  className,
  label,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <TableRow
      role="link"
      tabIndex={0}
      aria-label={label}
      className={cn(
        "group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40",
        className,
      )}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        if (window.getSelection()?.toString()) return;
        const target = event.target as HTMLElement;
        if (target.closest("a,button,input,select,textarea,[data-row-ignore]")) return;
        router.push(href);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          const target = event.target as HTMLElement;
          if (target.closest("a,button,input,select,textarea,[data-row-ignore]")) return;
          event.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </TableRow>
  );
}
