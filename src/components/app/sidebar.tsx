"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CheckSquare2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/actions/auth";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

type SidebarProps = {
  user: SessionUser;
  pendingCount: number;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
};

export function SidebarBody({ user, pendingCount, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";
  const canCreate = can(user.role, "request:create");

  const primary: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/requests", label: "Purchase requests", icon: FileText },
    { href: "/approvals", label: "Approvals", icon: CheckSquare2, badge: pendingCount },
    { href: "/vendors", label: "Vendors", icon: Building2 },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/contracts", label: "Contracts", icon: ScrollText },
  ];

  const admin: NavItem[] = [
    { href: "/audit", label: "Audit log", icon: ShieldCheck },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
          active
            ? "bg-white/[0.09] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "text-zinc-400 hover:bg-white/[0.06] hover:text-white",
        )}
      >
        {active ? (
          <span
            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-400"
            aria-hidden
          />
        ) : null}
        <Icon
          className={cn(
            "size-4 transition-transform duration-200 group-hover:scale-110",
            active ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300",
          )}
        />
        <span className="flex-1 truncate transition-transform duration-200 group-hover:translate-x-0.5">
          {item.label}
        </span>
        {item.badge ? (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_0_0_3px_rgba(99,102,241,0.18)]">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#12162b] via-[#0e1120] to-[#0b0e19] text-zinc-300">
      <div
        className="pointer-events-none absolute -top-28 left-1/2 size-72 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl"
        aria-hidden
      />

      <div className="relative flex h-14 items-center border-b border-white/10 px-4">
        <Brand href="/dashboard" inverted />
      </div>

      <div className="relative border-b border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-semibold text-indigo-200">
            {user.orgName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{user.orgName}</p>
            <p className="truncate text-[11px] text-zinc-400">Procurement workspace</p>
          </div>
          <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
            Demo
          </span>
        </div>
        {canCreate ? (
          <Button
            asChild
            size="sm"
            className="sheen mt-3 w-full justify-start bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-950/40 hover:from-indigo-400 hover:to-violet-400"
          >
            <Link href="/requests/new" onClick={onNavigate}>
              <Plus className="size-4" /> New request
            </Link>
          </Button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new Event("opsledger:command"));
            onNavigate?.();
          }}
          className="mt-2 flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300 transition-all duration-200 hover:border-indigo-400/30 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <Sparkles className="size-3.5 text-indigo-300" />
          <span className="flex-1 text-left">Ask OpsLedger</span>
          <kbd className="rounded border border-white/10 bg-white/[0.03] px-1 py-0.5 font-sans text-[10px] text-zinc-500">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Workspace</p>
        <div className="space-y-0.5">{primary.map(renderItem)}</div>
        {isAdmin ? (
          <>
            <p className="mb-1 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Administration
            </p>
            <div className="space-y-0.5">{admin.map(renderItem)}</div>
          </>
        ) : null}
      </nav>

      <div className="relative border-t border-white/10 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60">
              <UserAvatar name={user.fullName} className="bg-white/10 text-white ring-1 ring-white/10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{user.fullName}</span>
                <span className="block truncate text-[11px] text-zinc-400">{user.title ?? user.email}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel>
              <span className="block text-xs font-medium text-foreground">{user.fullName}</span>
              <span className="block truncate text-[11px] font-normal">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={logoutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2 text-left text-sm">
                  <LogOut className="size-4" /> Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="mt-2 flex items-center gap-1.5 px-1.5 text-[10px] text-zinc-500">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Demo data · safe to explore
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar(props: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-white/5 bg-[#0b0e19] lg:block">
      <SidebarBody {...props} />
    </aside>
  );
}

export function MobileNav(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[280px] border-r-0 bg-[#0b0e19] p-0 text-zinc-300">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody {...props} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
