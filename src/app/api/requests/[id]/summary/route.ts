import { ApiAuthError, requireApiUser } from "@/lib/auth";
import { generateComparisonSummary } from "@/lib/services/comparison";
import { ServiceError } from "@/lib/services/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser("quotation:read");
    const { id } = await params;
    let weights: unknown;
    try {
      const body = (await request.json()) as { weights?: unknown };
      weights = body.weights;
    } catch {
      weights = undefined;
    }
    const result = await generateComparisonSummary(user, id, weights);
    return Response.json({
      summary: result.summary,
      provider: result.provider,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ServiceError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "The summary could not be generated." }, { status: 500 });
  }
}
