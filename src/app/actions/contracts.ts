"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { contractSchema, firstError } from "@/lib/validation/schemas";
import { errorMessage } from "@/lib/services/errors";
import {
  addContractDocument,
  createContract,
  renewContract,
  updateContract,
} from "@/lib/services/contracts";
import type { ActionResult } from "@/lib/action-result";

function revalidateContract(id?: string) {
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/contracts/${id}`);
}

export async function createContractAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    const contract = await createContract(user, parsed.data);
    revalidateContract(contract.id);
    return { ok: true, id: contract.id, success: "Contract registered." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateContractAction(contractId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await updateContract(user, contractId, parsed.data);
    revalidateContract(contractId);
    return { ok: true, id: contractId, success: "Contract updated." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function renewContractAction(contractId: string, months = 12): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await renewContract(user, contractId, months);
    revalidateContract(contractId);
    return { ok: true, success: `Contract renewed for ${months} months.` };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function uploadContractDocumentAction(
  contractId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF file." };
  try {
    await addContractDocument(user, contractId, {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    revalidateContract(contractId);
    return { ok: true, success: "Contract document attached." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
