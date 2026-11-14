"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Send, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { createRequestAction, updateRequestAction } from "@/app/actions/requests";
import { PROCUREMENT_CATEGORIES } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";

const itemSchema = z.object({
  description: z.string().trim().min(2, "Describe the line item"),
  quantity: z.number({ invalid_type_error: "Enter a quantity" }).int().min(1, "At least 1"),
  unit: z.string().trim().min(1, "Add a unit"),
  estimatedUnitPrice: z.number({ invalid_type_error: "Enter a unit price" }).min(0, "Cannot be negative"),
});

const formSchema = z.object({
  title: z.string().trim().min(4, "Give the request a clear title").max(140),
  description: z.string().trim().min(10, "Add a short justification").max(4000),
  category: z.string().trim().min(2, "Choose a category"),
  departmentId: z.string().min(1, "Choose a department"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  estimatedBudget: z.number({ invalid_type_error: "Enter a budget" }).min(0, "Cannot be negative"),
  requiredBy: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});

type FormValues = z.infer<typeof formSchema>;

export type RequestFormInitial = {
  id?: string;
  title: string;
  description: string;
  category: string;
  departmentId: string;
  priority: FormValues["priority"];
  estimatedBudget: number;
  requiredBy: string;
  items: { description: string; quantity: number; unit: string; estimatedUnitPrice: number }[];
};

export function RequestForm({
  departments,
  currency,
  initial,
  defaultDepartmentId,
  lockDepartment = false,
  cancelHref,
}: {
  departments: { id: string; name: string; code: string }[];
  currency: string;
  initial?: RequestFormInitial;
  defaultDepartmentId?: string | null;
  lockDepartment?: boolean;
  cancelHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial ?? {
      title: "",
      description: "",
      category: "IT Hardware",
      departmentId: defaultDepartmentId ?? departments[0]?.id ?? "",
      priority: "MEDIUM",
      estimatedBudget: 0,
      requiredBy: "",
      items: [{ description: "", quantity: 1, unit: "unit", estimatedUnitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (!isDirty) return;
    const warnOnClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnOnClose);
    return () => window.removeEventListener("beforeunload", warnOnClose);
  }, [isDirty]);

  const items = watch("items");
  const budget = watch("estimatedBudget");
  const lineTotal = useMemo(
    () =>
      (items ?? []).reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.estimatedUnitPrice) || 0;
        return sum + qty * price;
      }, 0),
    [items],
  );

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      title: values.title,
      description: values.description,
      category: values.category,
      departmentId: values.departmentId,
      priority: values.priority,
      estimatedBudget: values.estimatedBudget,
      requiredBy: values.requiredBy || undefined,
      items: values.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || "unit",
        estimatedUnitPrice: item.estimatedUnitPrice,
      })),
    };

    const result = isEdit
      ? await updateRequestAction(initial!.id!, payload)
      : await createRequestAction(payload);

    if (!result.ok) {
      toast.error(result.error ?? "The request could not be saved.");
      if (result.error?.toLowerCase().includes("department")) {
        setError("departmentId", { message: result.error });
      }
      return;
    }
    toast.success(result.success ?? "Saved.");
    const target = result.id ? `/requests/${result.id}` : cancelHref;
    router.push(target);
    router.refresh();
  });

  const budgetGap = Math.round((budget - lineTotal) * 100) / 100;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Request details</CardTitle>
          <CardDescription>Explain the business need. This becomes the auditable record approvers review.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Title" error={errors.title?.message} className="sm:col-span-2">
            <Input placeholder="e.g. Replacement laptops for design team" {...register("title")} />
          </FormField>

          <FormField label="Justification" error={errors.description?.message} className="sm:col-span-2">
            <Textarea
              rows={4}
              placeholder="What is needed, why now, and what happens if it is delayed?"
              {...register("description")}
            />
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

          <FormField label="Department" error={errors.departmentId?.message}>
            <Select {...register("departmentId")} disabled={lockDepartment}>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Priority" error={errors.priority?.message}>
            <Select {...register("priority")}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </FormField>

          <FormField label="Required by" error={errors.requiredBy?.message} hint="Optional target date.">
            <Input type="date" {...register("requiredBy")} />
          </FormField>

          <FormField
            label={`Estimated budget (${currency})`}
            error={errors.estimatedBudget?.message}
            hint="Used for approval routing and savings calculations."
          >
            <Input type="number" step="0.01" min="0" {...register("estimatedBudget", { valueAsNumber: true })} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Line items</CardTitle>
            <CardDescription>Break the request into deliverable quantities and estimated unit prices.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unit: "unit", estimatedUnitPrice: 0 })}
          >
            <Plus className="size-4" /> Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_90px_90px_130px_36px]"
            >
              <FormField label={index === 0 ? "Description" : undefined} error={errors.items?.[index]?.description?.message}>
                <Input placeholder="Item or service" {...register(`items.${index}.description`)} />
              </FormField>
              <FormField label={index === 0 ? "Qty" : undefined} error={errors.items?.[index]?.quantity?.message}>
                <Input type="number" min="1" step="1" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
              </FormField>
              <FormField label={index === 0 ? "Unit" : undefined} error={errors.items?.[index]?.unit?.message}>
                <Input placeholder="unit" {...register(`items.${index}.unit`)} />
              </FormField>
              <FormField
                label={index === 0 ? `Unit price (${currency})` : undefined}
                error={errors.items?.[index]?.estimatedUnitPrice?.message}
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`items.${index}.estimatedUnitPrice`, { valueAsNumber: true })}
                />
              </FormField>
              <div className={index === 0 ? "flex items-end pb-1" : "flex items-center"}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line item"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          {errors.items?.message ? <p className="text-xs text-red-600">{errors.items.message}</p> : null}

          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t pt-3 text-sm" aria-live="polite">
            <span className="text-muted-foreground">
              Line items total <span className="font-medium text-foreground tabular">{formatMoney(lineTotal, currency)}</span>
            </span>
            <span className="text-muted-foreground">
              Estimated budget{" "}
              <span className="font-medium text-foreground tabular">{formatMoney(budget || 0, currency)}</span>
            </span>
            <span className={budgetGap < 0 ? "text-amber-700" : "text-muted-foreground"}>
              {budgetGap < 0 ? "Over budget by " : "Headroom "}
              <span className="font-medium tabular">{formatMoney(Math.abs(budgetGap), currency)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-white/95 p-2.5 shadow-lg backdrop-blur">
        <p className="hidden items-center gap-1.5 px-1 text-xs text-muted-foreground sm:flex">
          <Send className="size-3.5 shrink-0" />
          {isEdit
            ? "Changes are written to the audit trail."
            : "Saved as a draft first — submit it from the request page to start approvals."}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
          <SubmitButton pending={isSubmitting}>{isEdit ? "Save changes" : "Save as draft"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
