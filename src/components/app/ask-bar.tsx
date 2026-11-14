"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

const HINTS = [
  "Search “hydraulic press”",
  "Find Apex Machinery Group",
  "Open a contract near renewal",
  "Jump to approvals waiting on you",
];

export function AskBar() {
  const [hint, setHint] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setHint((value) => (value + 1) % HINTS.length), 4200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("opsledger:command"))}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-indigo-100 bg-white/80 p-3.5 text-left shadow-sm backdrop-blur transition-all duration-300 hover:border-indigo-200 hover:shadow-[0_16px_36px_-24px_rgba(79,70,229,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
    >
      <span
        aria-hidden
        className="glint absolute inset-0 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/80 opacity-80"
      />
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/30">
        <Sparkles className="size-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-sm font-medium">Ask OpsLedger</span>
        <span key={hint} className="reveal block truncate text-xs text-muted-foreground">
          {HINTS[hint]}
        </span>
      </span>
      <kbd className="relative hidden rounded border bg-white/80 px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-500 sm:inline-flex">
        ⌘K
      </kbd>
      <ArrowRight className="relative size-4 shrink-0 text-indigo-400 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  );
}
