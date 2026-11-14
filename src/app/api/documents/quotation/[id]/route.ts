import { ApiAuthError, requireApiUser } from "@/lib/auth";
import { getQuotationDocument } from "@/lib/services/quotations";
import { getObject } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser("quotation:read");
    const { id } = await params;
    const document = await getQuotationDocument(user, id);
    if (!document) return new Response("Document not found", { status: 404 });
    const buffer = await getObject(document.storageKey);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.fileName.replace(/[^\w.-]+/g, "_")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return new Response(error.message, { status: error.status });
    return new Response("Unable to load document", { status: 500 });
  }
}
