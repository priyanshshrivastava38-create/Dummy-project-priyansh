"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({ children, pending, ...props }: ButtonProps & { pending?: boolean }) {
  const { pending: formPending } = useFormStatus();
  const busy = pending || formPending;
  return (
    <Button type="submit" disabled={busy || props.disabled} {...props}>
      {busy ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
