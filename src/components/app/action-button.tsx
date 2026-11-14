"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

export function ActionButton({
  action,
  children,
  confirmText,
  successFallback,
  redirectTo,
  onDone,
  ...buttonProps
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  confirmText?: string;
  successFallback?: string;
  redirectTo?: string;
  onDone?: () => void;
} & Omit<ButtonProps, "onClick">) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      {...buttonProps}
      disabled={pending || buttonProps.disabled}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        startTransition(async () => {
          const result = await action();
          if (result.ok) {
            toast.success(result.success ?? successFallback ?? "Done.");
            onDone?.();
            if (redirectTo) router.push(redirectTo);
            router.refresh();
          } else {
            toast.error(result.error ?? "That action could not be completed.");
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
