import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/app/sidebar";
import { CommandMenu } from "@/components/app/command-menu";
import { HelpMenu } from "@/components/app/help-menu";
import type { SessionUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";

export function Topbar({ user, pendingCount }: { user: SessionUser; pendingCount: number }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-white/90 px-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav user={user} pendingCount={pendingCount} />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-medium">{user.orgName}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3" aria-hidden />
            <span className="truncate">{ROLE_LABELS[user.role]} view</span>
          </p>
        </div>
        <Badge variant="secondary" className="gap-1 sm:hidden">
          Demo
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <CommandMenu role={user.role} />
        <HelpMenu role={user.role} />
        <Badge
          variant="outline"
          className="hidden gap-1.5 border-amber-200 bg-amber-50/70 text-amber-700 xl:inline-flex"
        >
          Demo environment
        </Badge>
        {can(user.role, "request:create") ? (
          <Button
            asChild
            size="sm"
            className="sheen bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-400"
          >
            <Link href="/requests/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New request</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
