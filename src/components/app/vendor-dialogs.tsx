"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Star } from "lucide-react";
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
import { createVendorAction, evaluateVendorAction, updateVendorAction } from "@/app/actions/vendors";
import { PROCUREMENT_CATEGORIES } from "@/lib/constants";

const rating = z
  .number({ invalid_type_error: "0–100" })
  .int()
  .min(0, "0–100")
  .max(100, "0–100")
  .nullable();

const vendorFormSchema = z.object({
  name: z.string().trim().min(2, "Vendor name is required").max(120),
  contactName: z.string().trim().min(2, "Contact name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(40),
  category: z.string().trim().min(2, "Choose a category").max(60),
  taxId: z.string().trim().max(40),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  complianceStatus: z.enum(["COMPLIANT", "PENDING", "NON_COMPLIANT"]),
  performanceRating: rating,
  deliveryReliability: rating,
  notes: z.string().max(2000),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

export type VendorFormInitial = {
  id?: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  taxId: string;
  status: "ACTIVE" | "INACTIVE";
  complianceStatus: "COMPLIANT" | "PENDING" | "NON_COMPLIANT";
  performanceRating: number | null;
  deliveryReliability: number | null;
  notes: string;
};

const toNullableNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function VendorFormDialog({ initial, trigger }: { initial?: VendorFormInitial; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const defaults: VendorFormValues = initial ?? {
    name: "",
    contactName: "",
    email: "",
    phone: "",
    category: "IT Hardware",
    taxId: "",
    status: "ACTIVE",
    complianceStatus: "PENDING",
    performanceRating: null,
    deliveryReliability: null,
    notes: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues>({ resolver: zodResolver(vendorFormSchema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      ...values,
      phone: values.phone || undefined,
      taxId: values.taxId || undefined,
      notes: values.notes || undefined,
      performanceRating: values.performanceRating,
      deliveryReliability: values.deliveryReliability,
    };
    const result = isEdit
      ? await updateVendorAction(initial!.id!, payload)
      : await createVendorAction(payload);
    if (!result.ok) {
      toast.error(result.error ?? "The vendor could not be saved.");
      return;
    }
    toast.success(result.success ?? "Vendor saved.");
    setOpen(false);
    if (!isEdit) reset(defaults);
    router.refresh();
    if (!isEdit && result.id) router.push(`/vendors/${result.id}`);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> Add vendor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription>
            Vendor records feed pricing, reliability and compliance into deterministic quotation scoring.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vendor name" error={errors.name?.message} className="sm:col-span-2">
              <Input placeholder="e.g. Meridian Office Systems" {...register("name")} />
            </FormField>
            <FormField label="Primary contact" error={errors.contactName?.message}>
              <Input placeholder="Full name" {...register("contactName")} />
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              <Input type="email" placeholder="sales@vendor.com" {...register("email")} />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <Input placeholder="+1 555 0100" {...register("phone")} />
            </FormField>
            <FormField label="Tax ID" error={errors.taxId?.message}>
              <Input placeholder="Optional" {...register("taxId")} />
            </FormField>
            <FormField label="Category" error={errors.category?.message}>
              <Select {...register("category")}>
                {PROCUREMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status" error={errors.status?.message}>
              <Select {...register("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FormField>
            <FormField label="Compliance" error={errors.complianceStatus?.message} className="sm:col-span-2">
              <Select {...register("complianceStatus")}>
                <option value="COMPLIANT">Compliant</option>
                <option value="PENDING">Pending review</option>
                <option value="NON_COMPLIANT">Non-compliant</option>
              </Select>
            </FormField>
            <FormField
              label="Performance rating"
              error={errors.performanceRating?.message}
              hint="0–100. Updated by evaluations when left blank."
            >
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="—"
                {...register("performanceRating", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField
              label="Delivery reliability"
              error={errors.deliveryReliability?.message}
              hint="0–100. Used for the reliability criterion."
            >
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="—"
                {...register("deliveryReliability", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField label="Internal notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea rows={2} placeholder="Sourcing notes, contract caveats…" {...register("notes")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting}>{isEdit ? "Save vendor" : "Add vendor"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const evaluationSchema = z.object({
  qualityScore: z.number({ invalid_type_error: "0–100" }).int().min(0).max(100),
  deliveryScore: z.number({ invalid_type_error: "0–100" }).int().min(0).max(100),
  complianceScore: z.number({ invalid_type_error: "0–100" }).int().min(0).max(100),
  comment: z.string().max(1000),
});

type EvaluationValues = z.infer<typeof evaluationSchema>;

export function EvaluateVendorDialog({
  vendorId,
  vendorName,
  initial,
}: {
  vendorId: string;
  vendorName: string;
  initial?: { qualityScore: number; deliveryScore: number; complianceScore: number };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaults: EvaluationValues = {
    qualityScore: initial?.qualityScore ?? 80,
    deliveryScore: initial?.deliveryScore ?? 80,
    complianceScore: initial?.complianceScore ?? 90,
    comment: "",
  };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EvaluationValues>({ resolver: zodResolver(evaluationSchema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    const result = await evaluateVendorAction(vendorId, {
      qualityScore: values.qualityScore,
      deliveryScore: values.deliveryScore,
      complianceScore: values.complianceScore,
      comment: values.comment || undefined,
    });
    if (!result.ok) {
      toast.error(result.error ?? "The evaluation could not be recorded.");
      return;
    }
    toast.success(result.success ?? "Evaluation recorded.");
    setOpen(false);
    reset(defaults);
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
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Star className="size-4" /> Record evaluation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Evaluate {vendorName}</DialogTitle>
          <DialogDescription>
            Scores are 0–100. Quality and delivery averages update the vendor&apos;s performance rating and reliability —
            which feed future quotation comparisons.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Quality" error={errors.qualityScore?.message}>
              <Input type="number" min="0" max="100" step="1" {...register("qualityScore", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Delivery" error={errors.deliveryScore?.message}>
              <Input type="number" min="0" max="100" step="1" {...register("deliveryScore", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Compliance" error={errors.complianceScore?.message}>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                {...register("complianceScore", { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <FormField label="Comment" error={errors.comment?.message}>
            <Textarea rows={3} placeholder="What went well or badly on this engagement?" {...register("comment")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting}>Save evaluation</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditVendorButton({ initial }: { initial: VendorFormInitial }) {
  return (
    <VendorFormDialog
      initial={initial}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Edit vendor
        </Button>
      }
    />
  );
}
