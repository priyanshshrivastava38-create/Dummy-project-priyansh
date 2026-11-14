"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

export function CommentForm({
  action,
  placeholder = "Add a comment for the request history…",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  placeholder?: string;
}) {
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setPending(true);
        void action(formData)
          .then((result) => {
            if (result.ok) {
              toast.success(result.success ?? "Comment added.");
              formRef.current?.reset();
              router.refresh();
            } else {
              toast.error(result.error ?? "The comment could not be added.");
            }
          })
          .finally(() => setPending(false));
      }}
      className="space-y-2"
    >
      <Textarea name="comment" placeholder={placeholder} rows={3} required minLength={2} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          Add comment
        </Button>
      </div>
    </form>
  );
}
