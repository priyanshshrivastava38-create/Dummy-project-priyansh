import { ApiAuthError, requireApiUser } from "@/lib/auth";
import { getAnalytics, parseRange } from "@/lib/services/analytics";
import { toCsv } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser("analytics:read");
    const url = new URL(request.url);
    const range = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
    const data = await getAnalytics(user, range);

    const rows: unknown[][] = [];
    for (const month of data.monthlyTrend) {
      rows.push(["Monthly spend", month.month, month.spend, month.count, month.savings, ""]);
    }
    for (const dept of data.departmentSpend) {
      rows.push([
        "Department spend",
        dept.name,
        dept.spend,
        dept.count,
        "",
        dept.budget ? `YTD ${dept.ytdSpend} of annual budget ${dept.budget}` : "No annual budget set",
      ]);
    }
    for (const vendor of data.vendorSpend) {
      rows.push(["Vendor spend", vendor.name, vendor.spend, vendor.awards, "", ""]);
    }
    for (const level of data.approvalBottlenecks) {
      rows.push(["Approval bottleneck", `Level ${level.level}`, "", level.count, "", `Avg ${level.avgDays} days`]);
    }

    const csv = toCsv(
      ["Section", "Label", "Spend", "Awards", "Savings", "Notes"],
      rows,
    );
    const fileRange = `${range.from.toISOString().slice(0, 10)}_to_${range.to.toISOString().slice(0, 10)}`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="opsledger-analytics-${fileRange}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return new Response(error.message, { status: error.status });
    return new Response("Unable to export analytics", { status: 500 });
  }
}
