"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { loginAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "OpsLedger123!";

const demoAccounts = [
  {
    role: "Administrator",
    name: "Olivia Grant",
    email: "admin@opsledger.app",
    blurb: "Full access, policies & audit",
    tone: "border-violet-200 bg-violet-50/60 hover:bg-violet-50",
    dot: "bg-violet-500",
  },
  {
    role: "Procurement",
    name: "Priya Nair",
    email: "procurement@opsledger.app",
    blurb: "Requests, vendors & scoring",
    tone: "border-sky-200 bg-sky-50/60 hover:bg-sky-50",
    dot: "bg-sky-500",
  },
  {
    role: "Approver",
    name: "Daniel Okafor",
    email: "manager.ops@opsledger.app",
    blurb: "Operations approvals",
    tone: "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50",
    dot: "bg-emerald-500",
  },
];

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to review requests, compare quotations and keep procurement accountable.
        </p>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Demo accounts</p>
          <span className="text-xs text-muted-foreground">one password for all</span>
        </div>
        <div className="grid gap-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
              }}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                account.tone,
                email === account.email && "ring-1 ring-ring/40",
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={cn("size-2 shrink-0 rounded-full", account.dot)} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{account.role}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.name} · {account.blurb}
                  </span>
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Password: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{DEMO_PASSWORD}</code>{" "}
          — click a card to fill the form.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {state.fieldErrors?.email ? <p className="text-xs text-destructive">{state.fieldErrors.email}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {state.fieldErrors?.password ? (
            <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        {state.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create a demo account
        </Link>
      </p>
    </div>
  );
}
