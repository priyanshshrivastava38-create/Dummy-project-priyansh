"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { signupAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signupAction, {});

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">
          New accounts join the seeded Northwind demo workspace as a department manager. Real organisations can replace
          this flow with Supabase Auth.
        </p>
      </div>

      <Alert tone="info" className="mb-5">
        You will see the Operations department’s requests and any approvals assigned to you. Ask the administrator
        account to change your role.
      </Alert>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" placeholder="Alex Morgan" autoComplete="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" placeholder="alex@company.com" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted-foreground">Use at least 8 characters with a letter and a number.</p>
        </div>

        {state.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
