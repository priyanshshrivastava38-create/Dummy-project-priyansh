import { requirePermission } from "@/lib/auth";
import { getRequestFormOptions } from "@/lib/services/requests";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { RequestForm } from "@/components/app/request-form";

export const metadata = { title: "New purchase request" };

export default async function NewRequestPage() {
  const user = await requirePermission("request:create");
  const options = await getRequestFormOptions(user);
  const lockDepartment = user.role === "APPROVER" && Boolean(user.departmentId);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Purchase requests", href: "/requests" },
            { label: "New request" },
          ]}
        />
        <PageHeader
          title="New purchase request"
          description="Saved as a draft first. Submit when the line items and budget are ready for approval routing."
          eyebrow={user.departmentName ?? user.orgName}
        />
      </div>
      <RequestForm
        departments={options.departments}
        currency={user.currency}
        defaultDepartmentId={user.departmentId}
        lockDepartment={lockDepartment}
        cancelHref="/requests"
      />
    </div>
  );
}
