"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { firstError, vendorSchema } from "@/lib/validation/schemas";
import { errorMessage } from "@/lib/services/errors";
import { createVendor, evaluateVendor, updateVendor } from "@/lib/services/vendors";
import type { ActionResult } from "@/lib/action-result";

function revalidateVendor(id?: string) {
  revalidatePath("/vendors");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  if (id) revalidatePath(`/vendors/${id}`);
}

export async function createVendorAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    const vendor = await createVendor(user, parsed.data);
    revalidateVendor(vendor.id);
    return { ok: true, id: vendor.id, success: `${vendor.name} added to the vendor directory.` };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateVendorAction(vendorId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await updateVendor(user, vendorId, parsed.data);
    revalidateVendor(vendorId);
    return { ok: true, id: vendorId, success: "Vendor updated." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function evaluateVendorAction(vendorId: string, input: {
  qualityScore: number;
  deliveryScore: number;
  complianceScore: number;
  comment?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await evaluateVendor(user, vendorId, input);
    revalidateVendor(vendorId);
    return { ok: true, success: "Evaluation recorded. Vendor ratings were recalculated." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
