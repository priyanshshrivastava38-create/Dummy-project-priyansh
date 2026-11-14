"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

export function CopyButton({
  value,
  label = "Reference",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const copiedOk = await writeClipboard(value);
    if (copiedOk) {
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      toast.error("Clipboard access was blocked by the browser.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()} ${value}`}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-transparent px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:border-border hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
        className,
      )}
    >
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
