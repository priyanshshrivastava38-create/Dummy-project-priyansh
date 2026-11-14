"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckSquare2,
  Download,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Loader2,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { can, type Role } from "@/lib/permissions";
import { cn, titleCase } from "@/lib/utils";

type SearchPayload = {
  requests: { id: string; reference: string; title: string; status: string; department: string }[];
  vendors: { id: string; name: string; category: string; complianceStatus: string }[];
  contracts: { id: string; title: string; status: string; vendorName: string }[];
};

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
  external?: boolean;
};

const EMPTY_RESULTS: SearchPayload = { requests: [], vendors: [], contracts: [] };

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}

function Highlighted({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle);
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span className="rounded-[3px] bg-indigo-100 px-0.5 text-indigo-800">
        {text.slice(index, index + needle.length)}
      </span>
      {text.slice(index + needle.length)}
    </>
  );
}

export function CommandMenu({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const actionItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: "action-export",
        label: "Export analytics as CSV",
        description: "Download spend, budget and cycle-time report",
        href: "/api/analytics/export",
        icon: Download,
        keywords: "download report csv",
        external: true,
      },
    ];
    if (can(role, "request:create")) {
      items.unshift({
        id: "action-new-request",
        label: "New purchase request",
        description: "Start a draft and route it for approval",
        href: "/requests/new",
        icon: FilePlus2,
        keywords: "create raise budget",
      });
    }
    return items;
  }, [role]);

  const navItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      { id: "nav-dashboard", label: "Overview", href: "/dashboard", icon: LayoutDashboard, keywords: "home dashboard" },
      { id: "nav-requests", label: "Purchase requests", href: "/requests", icon: FileText, keywords: "pr rfq" },
      { id: "nav-approvals", label: "Approvals", href: "/approvals", icon: CheckSquare2, keywords: "queue decisions" },
      { id: "nav-vendors", label: "Vendors", href: "/vendors", icon: Building2, keywords: "suppliers directory" },
      { id: "nav-analytics", label: "Analytics", href: "/analytics", icon: BarChart3, keywords: "spend reports" },
      { id: "nav-contracts", label: "Contracts", href: "/contracts", icon: ScrollText, keywords: "renewals risk" },
    ];
    if (can(role, "audit:read")) {
      items.push({ id: "nav-audit", label: "Audit log", href: "/audit", icon: ShieldCheck, keywords: "history governance" });
    }
    if (can(role, "settings:manage")) {
      items.push({ id: "nav-settings", label: "Settings", href: "/settings", icon: Settings, keywords: "users departments policies scoring" });
    }
    return items;
  }, [role]);

  const needle = query.trim().toLowerCase();
  const matches = useCallback(
    (item: CommandItem) =>
      !needle || `${item.label} ${item.description ?? ""} ${item.keywords ?? ""}`.toLowerCase().includes(needle),
    [needle],
  );

  const groups = useMemo(() => {
    const staticGroups = [
      { label: "Actions", items: actionItems.filter(matches) },
      { label: "Jump to", items: navItems.filter(matches) },
    ].filter((group) => group.items.length > 0);

    if (needle.length < 2) return staticGroups;

    const dynamicGroups = [
      {
        label: "Requests",
        items: results.requests.map<CommandItem>((request) => ({
          id: `request-${request.id}`,
          label: request.title,
          description: `${request.reference} · ${request.department} · ${titleCase(request.status)}`,
          href: `/requests/${request.id}`,
          icon: FileText,
        })),
      },
      {
        label: "Vendors",
        items: results.vendors.map<CommandItem>((vendor) => ({
          id: `vendor-${vendor.id}`,
          label: vendor.name,
          description: `${vendor.category} · ${titleCase(vendor.complianceStatus)}`,
          href: `/vendors/${vendor.id}`,
          icon: Building2,
        })),
      },
      {
        label: "Contracts",
        items: results.contracts.map<CommandItem>((contract) => ({
          id: `contract-${contract.id}`,
          label: contract.title,
          description: `${contract.vendorName} · ${titleCase(contract.status)}`,
          href: `/contracts/${contract.id}`,
          icon: ScrollText,
        })),
      },
    ].filter((group) => group.items.length > 0);

    if (results.requests.length > 0) {
      dynamicGroups[0]?.items.push({
        id: "all-requests",
        label: `See all requests for “${query.trim()}”`,
        description: "Open the filtered request list",
        href: `/requests?q=${encodeURIComponent(query.trim())}`,
        icon: Search,
      });
    }

    return [...staticGroups, ...dynamicGroups];
  }, [actionItems, matches, navItems, needle, query, results]);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeIndex = flatItems.length ? Math.min(active, flatItems.length - 1) : 0;

  const run = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setQuery("");
      setResults(EMPTY_RESULTS);
      if (item.external) {
        window.location.href = item.href;
        return;
      }
      router.push(item.href);
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !isTyping(event.target);
      if (!shortcut && !slash) return;
      event.preventDefault();
      setOpen((value) => !value);
    }
    const openFromLauncher = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("opsledger:command", openFromLauncher);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("opsledger:command", openFromLauncher);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as SearchPayload;
        setResults(data);
      } catch {
        if (!controller.signal.aborted) setResults(EMPTY_RESULTS);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flatItems.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (value + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (value - 1 + flatItems.length) % flatItems.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex];
      if (item) run(item);
    }
  };

  let cursor = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search OpsLedger"
        aria-keyshortcuts="Meta+K Control+K /"
        className="group inline-flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-input bg-zinc-50/70 px-2 text-xs text-muted-foreground transition-colors hover:border-indigo-200 hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 md:w-60 md:justify-start lg:w-64"
      >
        <Search className="size-3.5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
        <span className="hidden whitespace-nowrap md:inline">Search or jump to…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border bg-white px-1 py-0.5 font-sans text-[10px] font-medium text-zinc-500 lg:inline-flex">
          ⌘K
        </kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setResults(EMPTY_RESULTS);
            setActive(0);
          }
        }}
      >
        <DialogContent
          hideClose
          aria-describedby={undefined}
          className="top-[6%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[10%]"
        >
          <DialogTitle className="sr-only">Search OpsLedger</DialogTitle>

          <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400" />

          <div className="flex items-center gap-2.5 border-b px-4">
            <Search className="size-4 shrink-0 text-indigo-500" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              role="combobox"
              aria-label="Search requests, vendors and contracts"
              aria-controls="command-list"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-activedescendant={
                flatItems.length ? `command-option-${activeIndex}` : undefined
              }
              placeholder="Search requests, vendors, contracts…"
              autoComplete="off"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-indigo-500" aria-label="Searching" />
            ) : (
              <kbd className="shrink-0 rounded border bg-zinc-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-500">
                esc
              </kbd>
            )}
          </div>

          <div className="relative h-0.5 overflow-hidden bg-transparent">
            {loading ? (
              <div
                className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                style={{ animation: "progress-slide 1.1s ease-in-out infinite" }}
              />
            ) : null}
          </div>

          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            aria-label="Search results"
            className="max-h-[58vh] overflow-y-auto p-2 scrollbar-thin"
          >
            {needle.length > 0 && needle.length < 2 ? (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">
                Keep typing — records search starts at two characters.
              </p>
            ) : null}

            {groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label} className="pb-1">
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  cursor += 1;
                  const index = cursor;
                  const Icon = item.icon;
                  const selected = index === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`command-option-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setActive(index)}
                      onClick={() => run(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-150",
                        selected ? "bg-indigo-50 shadow-[inset_2px_0_0_0_#6366f1]" : "hover:bg-zinc-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                          selected
                            ? "border-transparent bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/30"
                            : "border-zinc-200 bg-white text-zinc-500",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          <Highlighted text={item.label} needle={needle} />
                        </span>
                        {item.description ? (
                          <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                        ) : null}
                      </span>
                      <ArrowRight
                        className={cn(
                          "size-3.5 shrink-0 transition-all",
                          selected ? "translate-x-0 text-indigo-500" : "-translate-x-1 text-transparent",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ))}

            {needle.length >= 2 && !loading && flatItems.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">No matches for “{query.trim()}”</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a request reference, vendor name, contract title or category.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t bg-zinc-50/60 px-4 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-3">
              <span>
                <kbd className="rounded border bg-white px-1">↑</kbd>{" "}
                <kbd className="rounded border bg-white px-1">↓</kbd> navigate
              </span>
              <span>
                <kbd className="rounded border bg-white px-1">↵</kbd> open
              </span>
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <Sparkles className="size-3 text-indigo-400" />
              Keyword search · scoped to your role
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
