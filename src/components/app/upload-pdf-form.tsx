"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";

export function UploadPdfForm({
  action,
  label = "Upload PDF",
  hint = "PDF only, up to 10 MB.",
  compact = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0) {
          toast.error("Choose a PDF first.");
          return;
        }
        setPending(true);
        void action(formData)
          .then((result) => {
            if (result.ok) {
              toast.success(result.success ?? "Uploaded.");
              inputRef.current!.value = "";
              router.refresh();
            } else {
              toast.error(result.error ?? "Upload failed.");
            }
          })
          .finally(() => setPending(false));
      }}
    >
      <Input ref={inputRef} type="file" name="file" accept="application/pdf,.pdf" className={compact ? "h-8 text-xs" : ""} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">{hint}</p>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <FileUp />}
          {label}
        </Button>
      </div>
    </form>
  );
}
