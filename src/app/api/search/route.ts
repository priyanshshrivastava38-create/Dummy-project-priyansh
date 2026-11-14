import { NextResponse, type NextRequest } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/auth";
import { listContracts } from "@/lib/services/contracts";
import { listPurchaseRequests } from "@/lib/services/requests";
import { listVendors } from "@/lib/services/vendors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({ requests: [], vendors: [], contracts: [] });
    }

    const [requests, vendors, contracts] = await Promise.all([
      listPurchaseRequests(user, { q, perPage: 5 }),
      listVendors(user, { q }),
      listContracts(user, { q }),
    ]);

    return NextResponse.json({
      requests: requests.items.slice(0, 5).map((item) => ({
        id: item.id,
        reference: item.reference,
        title: item.title,
        status: item.status,
        department: item.department.name,
      })),
      vendors: vendors.rows.slice(0, 4).map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        complianceStatus: vendor.complianceStatus,
      })),
      contracts: contracts.items.slice(0, 4).map((contract) => ({
        id: contract.id,
        title: contract.title,
        status: contract.displayStatus,
        vendorName: contract.vendor.name,
      })),
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Search request failed", error);
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
