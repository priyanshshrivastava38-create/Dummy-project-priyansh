"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, MessageSquareWarning, X } from "lucide-react";
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
import { decideApprovalAction } from "@/app/actions/approvals";
import type { ApprovalAction } from "@/lib/services/approvals";

export function ApprovalDecision({
  stepId,
  reference,
  level,
  compact = false,
}: {
  stepId: string;
  reference: string;
  level: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (action: ApprovalAction) => {
    if ((action === "REJECT" || action === "REQUEST_CLARIFICATION") && comment.trim().length < 5) {
      toast.error("Add a reason of at least 5 characters.");
      return;
    }
    startTransition(async () => {
      const result = await decideApprovalAction(stepId, action, comment);
      if (result.ok) {
        toast.success(result.success ?? "Decision recorded.");
        setOpen(false);
        setComment("");
        router.refresh();
      } else {
        toast.error(result.error ?? "The decision could not be recorded.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={compact ? "sm" : "default"} variant={compact ? "outline" : "default"}>
          Review decision
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {reference}</DialogTitle>
          <DialogDescription>
            Level {level} approval. Approving moves the request to the next approver or final approval.
            Rejections require a reason that is stored in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={`comment-${stepId}`} className="text-xs font-medium">
            Comment or reason
          </label>
          <Textarea
            id={`comment-${stepId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Add context for the requester and the audit trail…"
            rows={4}
          />
          <p className="text-[11px] text-muted-foreground">
            Required for rejections and clarification requests. Optional for approvals.
          </p>
        </div>
        <DialogFooter className="flex-wrap">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => submit("REQUEST_CLARIFICATION")}
            className="gap-1.5"
          >
            {pending ? <Loader2 className="animate-spin" /> : <MessageSquareWarning />}
            Request clarification
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => submit("REJECT")}>
            <X /> Reject
          </Button>
          <Button disabled={pending} onClick={() => submit("APPROVE")}>
            <Check /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
