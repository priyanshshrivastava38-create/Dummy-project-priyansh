"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { decideApproval, type ApprovalAction } from "@/lib/services/approvals";
import { errorMessage } from "@/lib/services/errors";
import type { ActionResult } from "@/lib/action-result";

const ACTIONS: ApprovalAction[] = ["APPROVE", "REJECT", "REQUEST_CLARIFICATION"];

export async function decideApprovalAction(
  stepId: string,
  action: string,
  comment: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user.role, "approval:act")) {
    return { ok: false, error: "You do not have permission to act on approvals." };
  }
  if (!ACTIONS.includes(action as ApprovalAction)) {
    return { ok: false, error: "Unknown approval action." };
  }
  try {
    await decideApproval(user, stepId, action as ApprovalAction, comment);
    revalidatePath("/approvals");
    revalidatePath("/dashboard");
    revalidatePath("/requests");
    revalidatePath("/analytics");
    return {
      ok: true,
      success:
        action === "APPROVE"
          ? "Approval recorded."
          : action === "REJECT"
            ? "Request rejected. The reason was recorded."
            : "Clarification requested.",
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
