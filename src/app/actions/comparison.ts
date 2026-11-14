"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveScoringWeights } from "@/lib/services/comparison";
import { errorMessage } from "@/lib/services/errors";
import type { ActionResult } from "@/lib/action-result";

export async function saveWeightsAction(requestId: string, weights: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await saveScoringWeights(user, requestId, weights);
    revalidatePath(`/requests/${requestId}/compare`);
    revalidatePath(`/requests/${requestId}`);
    return { ok: true, success: "Scoring weights saved for this request." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
