import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPurchaseRequest, getRequestFormOptions } from "@/lib/services/requests";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { RequestForm } from "@/components/app/request-form";

export const metadata = { title: "Edit purchase request" };

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const request = await getPurchaseRequest(user, id);
  if (!request) notFound();

  const hasClarification = request.approvalSteps.some((step) => step.status === "CLARIFICATION_REQUESTED");
  const editable = ["DRAFT", "REJECTED"].includes(request.status) || hasClarification;
  const canEdit = request.requesterId === user.id || user.role === "ADMIN";
  if (!editable || !canEdit) redirect(`/requests/${id}`);

  const options = await getRequestFormOptions(user);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Purchase requests", href: "/requests" },
            { label: request.reference, href: `/requests/${id}` },
            { label: "Edit" },
          ]}
        />
        <PageHeader
          title="Edit purchase request"
          description="Changes are audited. Submitting again rebuilds the approval chain from the current budget."
          eyebrow={request.reference}
        />
      </div>
      <RequestForm
        departments={options.departments}
        currency={user.currency}
        lockDepartment={user.role === "APPROVER" && Boolean(user.departmentId)}
        cancelHref={`/requests/${id}`}
        initial={{
          id: request.id,
          title: request.title,
          description: request.description,
          category: request.category,
          departmentId: request.departmentId,
          priority: request.priority,
          estimatedBudget: Number(request.estimatedBudget),
          requiredBy: request.requiredBy ? request.requiredBy.toISOString().slice(0, 10) : "",
          items: request.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            estimatedUnitPrice: Number(item.estimatedUnitPrice),
          })),
        }}
      />
    </div>
  );
}
