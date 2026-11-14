import { cn, initials } from "@/lib/utils";

export function UserAvatar({
  name,
  className,
  tone = "indigo",
}: {
  name: string;
  className?: string;
  tone?: "indigo" | "zinc" | "emerald" | "amber";
}) {
  const tones = {
    indigo: "bg-indigo-100 text-indigo-700",
    zinc: "bg-zinc-200 text-zinc-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  } as const;
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        tones[tone],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
