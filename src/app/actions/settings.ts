"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  departmentSchema,
  firstError,
  policySchema,
  userAdminSchema,
} from "@/lib/validation/schemas";
import { errorMessage, ServiceError } from "@/lib/services/errors";
import {
  createDepartment,
  createUser,
  savePolicy,
  updateDefaultWeights,
  updateDepartment,
  updateUserAdmin,
} from "@/lib/services/settings";
import type { ActionResult } from "@/lib/action-result";

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
}

function parseUser(input: unknown) {
  return userAdminSchema.safeParse(input);
}

export async function createUserAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseUser(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!parsed.data.password) return { ok: false, error: "Set a password of at least 8 characters." };
  try {
    await createUser(user, { ...parsed.data, password: parsed.data.password });
    revalidateSettings();
    return { ok: true, success: "User created." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateUserAction(userId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseUser(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await updateUserAdmin(user, userId, {
      ...parsed.data,
      password: parsed.data.password || undefined,
    });
    revalidateSettings();
    return { ok: true, success: "User updated." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function createDepartmentAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await createDepartment(user, parsed.data);
    revalidateSettings();
    return { ok: true, success: "Department created." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateDepartmentAction(departmentId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await updateDepartment(user, departmentId, parsed.data);
    revalidateSettings();
    return { ok: true, success: "Department updated." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function savePolicyAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await savePolicy(user, { ...parsed.data, id: (input as { id?: string })?.id });
    revalidateSettings();
    return { ok: true, success: "Approval policy saved." };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateDefaultWeightsAction(weights: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await updateDefaultWeights(user, weights);
    revalidateSettings();
    revalidatePath("/requests", "layout");
    return { ok: true, success: "Default scoring weights updated." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
