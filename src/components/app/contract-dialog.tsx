"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FilePlus2, Pencil } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { createContractAction, updateContractAction } from "@/app/actions/contracts";

const contractFormSchema = z
  .object({
    title: z.string().trim().min(3, "Give the contract a title").max(160),
    vendorId: z.string().min(1, "Choose a vendor"),
    value: z.number({ invalid_type_error: "Enter a value" }).min(0, "Cannot be negative"),
    startDate: z.string().min(1, "Choose a start date"),
    endDate: z.string().min(1, "Choose an end date"),
    renewalDate: z.string(),
    status: z.enum(["DRAFT", "ACTIVE", "EXPIRING", "EXPIRED", "RENEWED", "TERMINATED"]),
    notes: z.string().max(3000),
  })
  .refine((value) => !value.endDate || !value.startDate || value.endDate > value.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  })
  .refine((value) => !value.renewalDate || !value.startDate || value.renewalDate >= value.startDate, {
    message: "Renewal cannot be before the start date",
    path: ["renewalDate"],
  });

type FormValues = z.infer<typeof contractFormSchema>;

export type ContractInitial = {
  id?: string;
  title: string;
  vendorId: string;
  value: number;
  startDate: string;
  endDate: string;
  renewalDate: string;
  status: "DRAFT" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWED" | "TERMINATED";
  notes: string;
};

export function ContractDialog({
  vendors,
  currency,
  initial,
  trigger,
}: {
  vendors: { id: string; name: string }[];
  currency: string;
  initial?: ContractInitial;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const defaults: FormValues = initial ?? {
    title: "",
    vendorId: vendors[0]?.id ?? "",
    value: 0,
    startDate: "",
    endDate: "",
    renewalDate: "",
    status: "ACTIVE",
    notes: "",
  };

  const freshCreateValues = (): FormValues => {
    const start = new Date();
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return {
      ...defaults,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(contractFormSchema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      title: values.title,
      vendorId: values.vendorId,
      value: values.value,
      startDate: values.startDate,
      endDate: values.endDate,
      renewalDate: values.renewalDate || undefined,
      status: values.status,
      notes: values.notes || undefined,
    };
    const result = isEdit
      ? await updateContractAction(initial!.id!, payload)
      : await createContractAction(payload);
    if (!result.ok) {
      toast.error(result.error ?? "The contract could not be saved.");
      return;
    }
    toast.success(result.success ?? "Contract saved.");
    setOpen(false);
    router.refresh();
    if (!isEdit && result.id) router.push(`/contracts/${result.id}`);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(isEdit ? defaults : freshCreateValues());
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <FilePlus2 className="size-4" /> New contract
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contract" : "Register contract"}</DialogTitle>
          <DialogDescription>
            Track value, term and renewal dates. Expiry risk is derived from the end and renewal dates — it is never
            entered manually.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Title" error={errors.title?.message} className="sm:col-span-2">
              <Input placeholder="e.g. Office supplies framework 2026" {...register("title")} />
            </FormField>
            <FormField label="Vendor" error={errors.vendorId?.message}>
              <Select {...register("vendorId")}>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={`Contract value (${currency})`} error={errors.value?.message}>
              <Input type="number" min="0" step="0.01" {...register("value", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Start date" error={errors.startDate?.message}>
              <Input type="date" {...register("startDate")} />
            </FormField>
            <FormField label="End date" error={errors.endDate?.message}>
              <Input type="date" {...register("endDate")} />
            </FormField>
            <FormField
              label="Renewal date"
              error={errors.renewalDate?.message}
              hint="Optional. Defaults to the end date for expiry warnings."
            >
              <Input type="date" {...register("renewalDate")} />
            </FormField>
            <FormField label="Status" error={errors.status?.message}>
              <Select {...register("status")}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRING">Expiring</option>
                <option value="EXPIRED">Expired</option>
                <option value="RENEWED">Renewed</option>
                <option value="TERMINATED">Terminated</option>
              </Select>
            </FormField>
            <FormField label="Notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea rows={2} placeholder="Renewal owner, auto-renew terms, exit clauses…" {...register("notes")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting}>{isEdit ? "Save contract" : "Register contract"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditContractButton(props: {
  vendors: { id: string; name: string }[];
  currency: string;
  initial: ContractInitial;
}) {
  return (
    <ContractDialog
      {...props}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Edit contract
        </Button>
      }
    />
  );
}
