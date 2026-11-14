"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { requestSchema } from "@/lib/validation/schemas";
import { firstError } from "@/lib/validation/schemas";
import { errorMessage } from "@/lib/services/errors";
import {
  addRequestDocument,
  advancePurchaseRequest,
  cancelPurchaseRequest,
  createPurchaseRequest,
  deletePurchaseRequest,
  submitPurchaseRequest,
  updatePurchaseRequest,
} from "@/lib/services/requests";
import { addRequestComment } from "@/lib/services/approvals";
import type { ActionResult } from "@/lib/action-result";

function revalidateRequest(id?: string) {
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  revalidatePath("/analytics");
  if (id) {
    revalidatePath(`/requests/${id}`);
    revalidatePath(`/requests/${id}/compare`);
  }
}

export async function createRequestAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    const request = await createPurchaseRequest(user, parsed.data);
    revalidateRequest(request.id);
    return { ok: true, id: request.id, success: `${request.reference} saved as a draft.` };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateRequestAction(requestId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await updatePurchaseRequest(user, requestId, parsed.data);
    revalidateRequest(requestId);
    return { ok: true, id: requestId, success: "Request updated." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function submitRequestAction(requestId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const result = await submitPurchaseRequest(user, requestId);
    revalidateRequest(requestId);
    return { ok: true, success: `Submitted for approval (${result.levels} level${result.levels === 1 ? "" : "s"} · ${result.policy}).` };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function cancelRequestAction(requestId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await cancelPurchaseRequest(user, requestId, String(formData.get("reason") ?? ""));
    revalidateRequest(requestId);
    return { ok: true, success: "Request cancelled. The reason was recorded." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteRequestAction(requestId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deletePurchaseRequest(user, requestId);
    revalidateRequest();
    return { ok: true, success: "Draft deleted." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function advanceRequestAction(
  requestId: string,
  action: "START_SOURCING" | "COMPLETE",
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await advancePurchaseRequest(user, requestId, action);
    revalidateRequest(requestId);
    return {
      ok: true,
      success: action === "START_SOURCING" ? "Request moved into sourcing." : "Request marked complete.",
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function addCommentAction(requestId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await addRequestComment(user, requestId, String(formData.get("comment") ?? ""));
    revalidateRequest(requestId);
    return { ok: true, success: "Comment added." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function uploadRequestDocumentAction(
  requestId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a PDF to attach." };
  }
  try {
    await addRequestDocument(user, requestId, {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    revalidateRequest(requestId);
    return { ok: true, success: "Document attached." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
