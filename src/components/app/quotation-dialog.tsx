"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { createQuotationAction, updateQuotationAction } from "@/app/actions/quotations";
import { formatMoney } from "@/lib/utils";
import { PAYMENT_TERMS } from "@/lib/constants";

const rowSchema = z.object({
  description: z.string().trim().min(1, "Describe the line item"),
  quantity: z.number({ invalid_type_error: "Qty" }).int().min(1, "Min 1"),
  unitPrice: z.number({ invalid_type_error: "Price" }).min(0, "Cannot be negative"),
});

const nullableNumber = (label: string, max = 1_000_000_000) =>
  z
    .number({ invalid_type_error: `Enter ${label}` })
    .min(0, "Cannot be negative")
    .max(max, "Too large")
    .nullable();

const quotationFormSchema = z
  .object({
    vendorId: z.string().min(1, "Choose a vendor"),
    items: z.array(rowSchema).max(50),
    taxAmount: nullableNumber("tax"),
    additionalCharges: nullableNumber("charges"),
    totalAmount: nullableNumber("a total"),
    deliveryDays: nullableNumber("delivery days", 3650),
    paymentTerms: z.string().max(200),
    warrantyMonths: nullableNumber("warranty", 240),
    validityDate: z.string(),
    notes: z.string().max(2000),
  })
  .refine((value) => value.items.length > 0 || (value.totalAmount ?? 0) > 0, {
    message: "Add line items or enter a quoted total",
    path: ["totalAmount"],
  });

type FormValues = z.infer<typeof quotationFormSchema>;

export type QuotationInitial = {
  id: string;
  vendorId: string;
  taxAmount: number | null;
  additionalCharges: number | null;
  totalAmount: number | null;
  deliveryDays: number | null;
  paymentTerms: string | null;
  warrantyMonths: number | null;
  validityDate: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unitPrice: number }[];
};

const blankItem = { description: "", quantity: 1, unitPrice: 0 };
const toNullableNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function QuotationDialog({
  requestId,
  vendors,
  currency,
  initial,
  trigger,
}: {
  requestId: string;
  vendors: { id: string; name: string }[];
  currency: string;
  initial?: QuotationInitial;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(initial);

  const defaults: FormValues = initial
    ? {
        vendorId: initial.vendorId,
        items: initial.items.length ? initial.items : [blankItem],
        taxAmount: initial.taxAmount,
        additionalCharges: initial.additionalCharges,
        totalAmount: initial.totalAmount,
        deliveryDays: initial.deliveryDays,
        paymentTerms: initial.paymentTerms ?? "",
        warrantyMonths: initial.warrantyMonths,
        validityDate: initial.validityDate ?? "",
        notes: initial.notes ?? "",
      }
    : {
        vendorId: vendors[0]?.id ?? "",
        items: [blankItem],
        taxAmount: null,
        additionalCharges: null,
        totalAmount: null,
        deliveryDays: null,
        paymentTerms: "Net 30",
        warrantyMonths: null,
        validityDate: "",
        notes: "",
      };

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = watch();
  const subtotal = (watched.items ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const computedTotal =
    subtotal + (Number(watched.taxAmount) || 0) + (Number(watched.additionalCharges) || 0);
  const effectiveTotal = (watched.items ?? []).length ? computedTotal : Number(watched.totalAmount) || 0;
  const duplicateVendor = vendors.some((vendor) => vendor.id === watched.vendorId);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      vendorId: values.vendorId,
      items: values.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      taxAmount: values.taxAmount,
      additionalCharges: values.additionalCharges,
      totalAmount: values.items.length ? null : values.totalAmount,
      deliveryDays: values.deliveryDays,
      paymentTerms: values.paymentTerms || undefined,
      warrantyMonths: values.warrantyMonths,
      validityDate: values.validityDate || undefined,
      notes: values.notes || undefined,
    };

    const result = isEdit
      ? await updateQuotationAction(initial!.id, requestId, payload)
      : await createQuotationAction(requestId, payload);

    if (!result.ok) {
      toast.error(result.error ?? "The quotation could not be saved.");
      return;
    }
    toast.success(result.success ?? "Quotation saved.");
    setOpen(false);
    if (!isEdit) reset(defaults);
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Correct quotation" : "Record a quotation"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Corrections are audited. Quotations extracted by AI are marked as corrected after saving."
              : "Enter the vendor's offer. Use line items for priced quantities, or just a total for lump-sum quotes."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vendor" error={errors.vendorId?.message} className="sm:col-span-2">
              <Select {...register("vendorId")} disabled={isEdit}>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </Select>
              {!duplicateVendor && !isEdit ? (
                <p className="text-[11px] text-amber-600">That vendor is not in the active directory.</p>
              ) : null}
            </FormField>

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Line items</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ ...blankItem })}
                >
                  <Plus className="size-3.5" /> Add line
                </Button>
              </div>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-2 rounded-lg border bg-muted/20 p-2.5 sm:grid-cols-[1fr_70px_100px_32px]"
                >
                  <FormField error={errors.items?.[index]?.description?.message}>
                    <Input placeholder="Line item" {...register(`items.${index}.description`)} />
                  </FormField>
                  <FormField error={errors.items?.[index]?.quantity?.message}>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Qty"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </FormField>
                  <FormField error={errors.items?.[index]?.unitPrice?.message}>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit price"
                      {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                    />
                  </FormField>
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove line"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <FormField label="Tax amount" error={errors.taxAmount?.message}>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register("taxAmount", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField label="Additional charges" error={errors.additionalCharges?.message}>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Freight, installation…"
                {...register("additionalCharges", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField label="Delivery days" error={errors.deliveryDays?.message}>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 14"
                {...register("deliveryDays", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField label="Warranty (months)" error={errors.warrantyMonths?.message}>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 24"
                {...register("warrantyMonths", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField label="Payment terms" error={errors.paymentTerms?.message}>
              <Input list="payment-terms" placeholder="Net 30" {...register("paymentTerms")} />
              <datalist id="payment-terms">
                {PAYMENT_TERMS.map((term) => (
                  <option key={term} value={term} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Valid until" error={errors.validityDate?.message}>
              <Input type="date" {...register("validityDate")} />
            </FormField>
            <FormField
              label={`Quoted total (${currency})`}
              error={errors.totalAmount?.message}
              className="sm:col-span-2"
              hint={
                (watched.items ?? []).length
                  ? "Calculated from line items, tax and charges."
                  : "Used when the vendor quotes a single lump sum."
              }
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={(watched.items ?? []).length > 0}
                {...register("totalAmount", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField label="Notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea rows={2} placeholder="Anything the approver should know about this quote." {...register("notes")} />
            </FormField>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {(watched.items ?? []).length ? "Calculated total" : "Quoted total"}
            </span>
            <span className="font-semibold tabular">{formatMoney(effectiveTotal, currency)}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting}>{isEdit ? "Save correction" : "Record quotation"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
