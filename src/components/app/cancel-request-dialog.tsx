"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelRequestAction } from "@/app/actions/requests";

export function CancelRequestDialog({ requestId, reference }: { requestId: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Ban className="size-4" /> Cancel request
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {reference}</DialogTitle>
          <DialogDescription>
            The request will stop progressing and any open approval steps will be skipped. The reason is
            permanently recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="cancel-reason" className="text-xs font-medium">
            Cancellation reason
          </label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Duplicate request — covered by PR-2026-0007"
          />
          <p className="text-[11px] text-muted-foreground">At least 5 characters.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Keep request
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (reason.trim().length < 5) {
                toast.error("Give a cancellation reason of at least 5 characters.");
                return;
              }
              startTransition(async () => {
                const formData = new FormData();
                formData.set("reason", reason);
                const result = await cancelRequestAction(requestId, formData);
                if (!result.ok) {
                  toast.error(result.error ?? "The request could not be cancelled.");
                  return;
                }
                toast.success(result.success ?? "Request cancelled.");
                setOpen(false);
                setReason("");
                router.refresh();
              });
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Ban />}
            Cancel request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
