import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const money = z
  .number({ invalid_type_error: "Enter a valid amount" })
  .finite()
  .min(0, "Amount cannot be negative")
  .max(1_000_000_000, "Amount is too large");

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .transform((value) => new Date(`${value}T12:00:00.000Z`));

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

export const requestItemSchema = z.object({
  description: z.string().trim().min(2, "Describe the item").max(200),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(1_000_000),
  unit: z.string().trim().min(1).max(30).default("unit"),
  estimatedUnitPrice: money,
});

export const requestSchema = z.object({
  title: z.string().trim().min(4, "Give the request a clear title").max(140),
  description: z.string().trim().min(10, "Add a short justification").max(4000),
  category: z.string().trim().min(2, "Choose a category").max(60),
  departmentId: z.string().min(1, "Choose a department"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  estimatedBudget: money,
  requiredBy: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date")
    .transform((v) => (v ? new Date(`${v}T12:00:00.000Z`) : null)),
  items: z.array(requestItemSchema).min(1, "Add at least one line item").max(50),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2, "Vendor name is required").max(120),
  contactName: z.string().trim().min(2, "Contact name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: optionalText(40),
  category: z.string().trim().min(2, "Choose a category").max(60),
  taxId: optionalText(40),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  complianceStatus: z.enum(["COMPLIANT", "PENDING", "NON_COMPLIANT"]).default("PENDING"),
  performanceRating: z.number().int().min(0).max(100).nullable().optional(),
  deliveryReliability: z.number().int().min(0).max(100).nullable().optional(),
  notes: optionalText(2000),
});

export const quotationItemSchema = z.object({
  description: z.string().trim().min(1, "Describe the line item").max(300),
  quantity: z.number().int().min(1).max(1_000_000),
  unitPrice: money,
});

export const quotationSchema = z.object({
  vendorId: z.string().min(1, "Choose a vendor"),
  taxAmount: z.number().min(0).nullable().optional(),
  additionalCharges: z.number().min(0).nullable().optional(),
  totalAmount: z.number().min(0).nullable().optional(),
  deliveryDays: z.number().int().min(0).max(3650).nullable().optional(),
  paymentTerms: optionalText(200),
  warrantyMonths: z.number().int().min(0).max(240).nullable().optional(),
  validityDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date")
    .transform((v) => (v ? new Date(`${v}T12:00:00.000Z`) : null)),
  notes: optionalText(2000),
  items: z.array(quotationItemSchema).max(50),
});

export const weightsSchema = z
  .object({
    price: z.number().min(0).max(100),
    delivery: z.number().min(0).max(100),
    quality: z.number().min(0).max(100),
    reliability: z.number().min(0).max(100),
    payment: z.number().min(0).max(100),
  })
  .refine((w) => Math.abs(w.price + w.delivery + w.quality + w.reliability + w.payment - 100) < 0.01, {
    message: "Weights must add up to 100%",
  });

export type Weights = z.infer<typeof weightsSchema>;

export const DEFAULT_WEIGHTS: Weights = {
  price: 35,
  delivery: 20,
  quality: 20,
  reliability: 15,
  payment: 10,
};

export const contractSchema = z
  .object({
    title: z.string().trim().min(3, "Give the contract a title").max(160),
    vendorId: z.string().min(1, "Choose a vendor"),
    value: money,
    startDate: dateOnly,
    endDate: dateOnly,
    renewalDate: dateOnly.optional().nullable(),
    status: z.enum(["DRAFT", "ACTIVE", "EXPIRING", "EXPIRED", "RENEWED", "TERMINATED"]).default("ACTIVE"),
    notes: optionalText(3000),
  })
  .refine((c) => c.endDate.getTime() > c.startDate.getTime(), {
    message: "End date must be after the start date",
    path: ["endDate"],
  })
  .refine((c) => !c.renewalDate || c.renewalDate >= c.startDate, {
    message: "Renewal date cannot be before the start date",
    path: ["renewalDate"],
  });

export const policySchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    minAmount: money,
    maxAmount: z.number().min(0).nullable().optional(),
    levels: z.number().int().min(1).max(3),
    secondLevelRole: z.enum(["ADMIN", "PROCUREMENT_MANAGER"]).default("ADMIN"),
    isActive: z.boolean().default(true),
  })
  .refine((p) => p.maxAmount == null || p.maxAmount >= p.minAmount, {
    message: "Maximum must be greater than the minimum",
    path: ["maxAmount"],
  });

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers or dashes")
    .transform((v) => v.toUpperCase()),
  annualBudget: z.number().min(0).nullable().optional(),
});

export const userAdminSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "PROCUREMENT_MANAGER", "APPROVER"]),
  departmentId: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
