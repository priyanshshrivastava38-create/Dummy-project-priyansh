"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstError, quotationSchema } from "@/lib/validation/schemas";
import { errorMessage, ServiceError } from "@/lib/services/errors";
import {
  addQuotationDocument,
  createQuotation,
  extractQuotationDocument,
  selectQuotation,
  updateQuotation,
} from "@/lib/services/quotations";
import type { ActionResult } from "@/lib/action-result";
import { getAiStatus } from "@/lib/ai/provider";

function revalidateQuotation(requestId?: string) {
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  if (requestId) {
    revalidatePath(`/requests/${requestId}`);
    revalidatePath(`/requests/${requestId}/compare`);
  }
}

export async function createQuotationAction(requestId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    const quotation = await createQuotation(user, requestId, parsed.data);
    revalidateQuotation(requestId);
    return { ok: true, id: quotation.id, success: "Quotation recorded." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateQuotationAction(
  quotationId: string,
  requestId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await updateQuotation(user, quotationId, parsed.data);
    revalidateQuotation(requestId);
    return { ok: true, id: quotationId, success: "Quotation corrected." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function selectQuotationAction(quotationId: string, requestId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await selectQuotation(user, quotationId);
    revalidateQuotation(requestId);
    return { ok: true, success: "Vendor decision recorded." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function uploadQuotationDocumentAction(
  quotationId: string,
  requestId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a PDF quotation." };
  }
  try {
    const document = await addQuotationDocument(user, quotationId, {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    revalidateQuotation(requestId);
    const ai = getAiStatus();
    return {
      ok: true,
      id: document.id,
      success: ai.available
        ? "PDF attached. Run extraction to import the values with AI."
        : "PDF attached. No AI provider is configured, so enter the values manually.",
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function extractQuotationDocumentAction(
  documentId: string,
  requestId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user.role, "quotation:extract")) {
    return { ok: false, error: "You do not have permission to run extraction." };
  }
  try {
    const result = await extractQuotationDocument(user, documentId);
    revalidateQuotation(requestId);
    const confidence = result.extraction.overallConfidence;
    return {
      ok: true,
      success: `Extraction complete with ${result.provider.label}${
        confidence !== null ? ` (${confidence}% confidence)` : ""
      }. Review the extracted fields before relying on them.`,
    };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    return { ok: false, error: errorMessage(error) };
  }
}
