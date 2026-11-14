"use client";

import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Open search and commands" },
  { keys: ["/"], label: "Open search from anywhere" },
  { keys: ["↑", "↓"], label: "Move through results" },
  { keys: ["↵"], label: "Open the highlighted result" },
  { keys: ["Esc"], label: "Close a panel or palette" },
  { keys: ["?"], label: "Show this help" },
];

const AREAS = [
  ["Purchase requests", "Raise requests, attach documents and follow approvals."],
  ["Approvals", "Approve, reject with a reason, or ask for clarification."],
  ["Vendors", "Contacts, compliance, ratings and awarded spend."],
  ["Analytics", "Spend, cycle time and budget comparisons with CSV export."],
  ["Contracts", "Term dates, renewals and expiry risk."],
  ["Audit log", "Every consequential change with before/after values."],
];

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-600 shadow-xs">
      {children}
    </kbd>
  );
}

export function HelpMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Help and keyboard shortcuts"
          aria-keyshortcuts="?"
        >
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="border-b bg-gradient-to-r from-indigo-50 via-white to-violet-50/70 px-5 py-4">
          <DialogTitle className="text-base">Quick help</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            OpsLedger is keyboard-friendly. Nothing here changes data — it is just a map.
          </DialogDescription>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 scrollbar-thin">
          <section aria-labelledby="help-keyboard">
            <h3
              id="help-keyboard"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Keyboard
            </h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.label} className="flex items-center gap-2 text-xs">
                  <span className="flex shrink-0 items-center gap-0.5">
                    {shortcut.keys.map((key) => (
                      <Key key={key}>{key}</Key>
                    ))}
                  </span>
                  <dt className="min-w-0 flex-1 text-zinc-600">{shortcut.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="help-areas">
            <h3 id="help-areas" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Where things live
            </h3>
            <ul className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {AREAS.map(([title, description]) => (
                <li key={title} className="text-xs leading-snug">
                  <span className="font-medium text-foreground">{title}</span>
                  <span className="block text-muted-foreground">{description}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="rounded-lg border bg-zinc-50/70 p-3">
            <p className="text-xs font-medium">Signed in as {ROLE_LABELS[role]}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              The sidebar only shows areas your role can open, and every restricted change is also checked on the
              server — hiding a button is never the only control.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-zinc-50/60 px-5 py-2 text-[10px] text-muted-foreground">
          <span>
            Press <Key>?</Key> any time
          </span>
          <span>Demo workspace · seeded data</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
