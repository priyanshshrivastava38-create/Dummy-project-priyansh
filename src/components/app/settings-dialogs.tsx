"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, Pencil, Plus, ShieldCheck } from "lucide-react";
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
import { FormField } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import {
  createDepartmentAction,
  createUserAction,
  savePolicyAction,
  updateDepartmentAction,
  updateUserAction,
} from "@/app/actions/settings";
import { ROLE_LABELS } from "@/lib/permissions";

const toNullableNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toNumberOrZero = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserDialogInitial = {
  id?: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "PROCUREMENT_MANAGER" | "APPROVER";
  departmentId: string;
  isActive: boolean;
};

export type DepartmentOption = { id: string; name: string };

function userSchema(isEdit: boolean) {
  return z
    .object({
      fullName: z.string().trim().min(2, "Enter the full name").max(80),
      email: z.string().trim().email("Enter a valid email"),
      password: isEdit ? z.string().max(72) : z.string().min(8, "Use at least 8 characters").max(72),
      role: z.enum(["ADMIN", "PROCUREMENT_MANAGER", "APPROVER"]),
      departmentId: z.string(),
      isActive: z.enum(["true", "false"]),
    })
    .refine((values) => values.role !== "APPROVER" || values.departmentId.length > 0, {
      message: "Department managers need a department",
      path: ["departmentId"],
    });
}

type UserValues = z.infer<ReturnType<typeof userSchema>>;

export function UserDialog({
  initial,
  departments,
  trigger,
}: {
  initial?: UserDialogInitial;
  departments: DepartmentOption[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const schema = useMemo(() => userSchema(isEdit), [isEdit]);

  const defaults: UserValues = {
    fullName: initial?.fullName ?? "",
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? "APPROVER",
    departmentId: initial?.departmentId ?? "",
    isActive: initial?.isActive === false ? "false" : "true",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      fullName: values.fullName,
      email: values.email,
      password: values.password || "",
      role: values.role,
      departmentId: values.departmentId,
      isActive: values.isActive === "true",
    };
    const result = isEdit ? await updateUserAction(initial!.id!, payload) : await createUserAction(payload);
    if (!result.ok) {
      toast.error(result.error ?? "The user could not be saved.");
      return;
    }
    toast.success(result.success ?? "User saved.");
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
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> Add user
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit team member" : "Add team member"}</DialogTitle>
          <DialogDescription>
            Role permissions are enforced on the server for every request, approval and settings change.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Full name" error={errors.fullName?.message} className="sm:col-span-2">
              <Input placeholder="e.g. Amara Okafor" {...register("fullName")} />
            </FormField>
            <FormField label="Work email" error={errors.email?.message} className="sm:col-span-2">
              <Input type="email" placeholder="name@company.com" {...register("email")} />
            </FormField>
            <FormField
              label={isEdit ? "New password" : "Temporary password"}
              error={errors.password?.message}
              hint={isEdit ? "Leave blank to keep the current password." : "At least 8 characters."}
              className="sm:col-span-2"
            >
              <Input type="password" placeholder={isEdit ? "••••••••" : "Set a password"} {...register("password")} />
            </FormField>
            <FormField label="Role" error={errors.role?.message}>
              <Select {...register("role")}>
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Department" error={errors.departmentId?.message}>
              <Select {...register("departmentId")}>
                <option value="">No department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Account status" error={errors.isActive?.message} className="sm:col-span-2">
              <Select {...register("isActive")}>
                <option value="true">Active</option>
                <option value="false">Deactivated</option>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting}>{isEdit ? "Save changes" : "Create user"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserButton({
  initial,
  departments,
}: {
  initial: UserDialogInitial;
  departments: DepartmentOption[];
}) {
  return (
    <UserDialog
      initial={initial}
      departments={departments}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Edit
        </Button>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const departmentFormSchema = z.object({
  name: z.string().trim().min(2, "Enter a department name").max(80),
  code: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(12, "Use 12 characters or fewer")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers or dashes"),
  annualBudget: z.number().min(0, "Budget cannot be negative").nullable(),
});

type DepartmentValues = z.infer<typeof departmentFormSchema>;

export type DepartmentDialogInitial = {
  id?: string;
  name: string;
  code: string;
  annualBudget: number | null;
};

export function DepartmentDialog({
  initial,
  trigger,
}: {
  initial?: DepartmentDialogInitial;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const defaults: DepartmentValues = {
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    annualBudget: initial?.annualBudget ?? null,
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentValues>({ resolver: zodResolver(departmentFormSchema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      code: values.code,
      annualBudget: values.annualBudget,
    };
    const result = isEdit
      ? await updateDepartmentAction(initial!.id!, payload)
      : await createDepartmentAction(payload);
    if (!result.ok) {
      toast.error(result.error ?? "The department could not be saved.");
      return;
    }
    toast.success(result.success ?? "Department saved.");
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
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Building2 className="size-4" /> Add department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit department" : "Add department"}</DialogTitle>
          <DialogDescription>
            Department budgets drive budget-versus-actual reporting and approval routing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <FormField label="Department name" error={errors.name?.message}>
            <Input placeholder="e.g. Engineering" {...register("name")} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Code" error={errors.code?.message} hint="Short unique code, e.g. ENG.">
              <Input placeholder="ENG" {...register("code")} />
            </FormField>
            <FormField label="Annual budget" error={errors.annualBudget?.message} hint="Optional.">
              <Input
                type="number"
                min="0"
                step="1000"
                placeholder="—"
                {...register("annualBudget", { setValueAs: toNullableNumber })}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting}>{isEdit ? "Save department" : "Add department"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditDepartmentButton({ initial }: { initial: DepartmentDialogInitial }) {
  return (
    <DepartmentDialog
      initial={initial}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Edit
        </Button>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Approval policies
// ---------------------------------------------------------------------------

const policyFormSchema = z
  .object({
    name: z.string().trim().min(3, "Give the policy a name").max(100),
    minAmount: z.number().min(0, "Minimum cannot be negative"),
    maxAmount: z.number().min(0, "Maximum cannot be negative").nullable(),
    levels: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    secondLevelRole: z.enum(["ADMIN", "PROCUREMENT_MANAGER"]),
    isActive: z.enum(["true", "false"]),
  })
  .refine((values) => values.maxAmount === null || values.maxAmount >= values.minAmount, {
    message: "Maximum must be at least the minimum",
    path: ["maxAmount"],
  });

type PolicyValues = z.infer<typeof policyFormSchema>;

export type PolicyDialogInitial = {
  id?: string;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  levels: number;
  secondLevelRole: "ADMIN" | "PROCUREMENT_MANAGER" | null;
  isActive: boolean;
};

function normalizeLevels(levels: number): 1 | 2 | 3 {
  return levels === 3 ? 3 : levels === 2 ? 2 : 1;
}

export function PolicyDialog({
  initial,
  trigger,
}: {
  initial?: PolicyDialogInitial;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const defaults: PolicyValues = {
    name: initial?.name ?? "",
    minAmount: initial?.minAmount ?? 0,
    maxAmount: initial?.maxAmount ?? null,
    levels: normalizeLevels(initial?.levels ?? 1),
    secondLevelRole: initial?.secondLevelRole ?? "ADMIN",
    isActive: initial?.isActive === false ? "false" : "true",
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PolicyValues>({ resolver: zodResolver(policyFormSchema), defaultValues: defaults });
  const levels = Number(watch("levels"));

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      id: initial?.id,
      name: values.name,
      minAmount: values.minAmount,
      maxAmount: values.maxAmount,
      levels: values.levels,
      secondLevelRole: values.secondLevelRole,
      isActive: values.isActive === "true",
    };
    const result = await savePolicyAction(payload);
    if (!result.ok) {
      toast.error(result.error ?? "The policy could not be saved.");
      return;
    }
    toast.success(result.success ?? "Policy saved.");
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
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <ShieldCheck className="size-4" /> Add policy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit approval policy" : "Add approval policy"}</DialogTitle>
          <DialogDescription>
            Policies match on the request&apos;s estimated budget. The first approver is the department manager; extra
            levels escalate to the role selected below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <FormField label="Policy name" error={errors.name?.message}>
            <Input placeholder="e.g. Mid-value purchases" {...register("name")} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Minimum spend" error={errors.minAmount?.message}>
              <Input
                type="number"
                min="0"
                step="1000"
                {...register("minAmount", { setValueAs: toNumberOrZero })}
              />
            </FormField>
            <FormField label="Maximum spend" error={errors.maxAmount?.message} hint="Blank means no upper limit.">
              <Input
                type="number"
                min="0"
                step="1000"
                placeholder="No limit"
                {...register("maxAmount", { setValueAs: toNullableNumber })}
              />
            </FormField>
            <FormField label="Approval levels" error={errors.levels?.message}>
              <Select {...register("levels", { setValueAs: Number })}>
                <option value="1">1 level — manager</option>
                <option value="2">2 levels — manager + admin</option>
                <option value="3">3 levels — manager + admin + manager</option>
              </Select>
            </FormField>
            <FormField
              label="Second-level role"
              error={errors.secondLevelRole?.message}
              hint={levels < 2 ? "Only used when 2+ levels." : undefined}
            >
              <Select {...register("secondLevelRole")} disabled={levels < 2}>
                <option value="ADMIN">Administrator</option>
                <option value="PROCUREMENT_MANAGER">Procurement manager</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Policy status" error={errors.isActive?.message}>
            <Select {...register("isActive")}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={isSubmitting}>{isEdit ? "Save policy" : "Add policy"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditPolicyButton({ initial }: { initial: PolicyDialogInitial }) {
  return (
    <PolicyDialog
      initial={initial}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Edit
        </Button>
      }
    />
  );
}
