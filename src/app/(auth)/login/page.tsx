import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r bg-white p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 grid-dots opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="relative">
          <Brand href="/" />
          <div className="mt-16 max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Procurement intelligence</p>
            <h2 className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight text-balance">
              Every purchasing decision, explainable in one place.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              OpsLedger connects requests, quotations, weighted scoring and multi-level approvals — so the answer to
              “why this vendor?” is written down, not remembered.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Deterministic vendor scores, never black-box AI awards",
                "AI extraction with a mandatory document trail",
                "Approval chains that match your spend thresholds",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative rounded-xl border bg-zinc-50/80 p-4">
          <p className="text-xs font-medium text-muted-foreground">Illustrative ranking</p>
          <div className="mt-3 space-y-2.5">
            {[
              { name: "Meridian Industrial", score: 88.4, price: "$182,400" },
              { name: "Apex Fabrication", score: 81.2, price: "$176,950" },
              { name: "Northstar Supply", score: 72.8, price: "$191,200" },
            ].map((vendor, index) => (
              <div key={vendor.name} className="rounded-md border bg-white p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    <span className="mr-2 text-muted-foreground">{index + 1}</span>
                    {vendor.name}
                  </span>
                  <span className="tabular text-muted-foreground">{vendor.price}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${vendor.score}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold tabular">{vendor.score}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Weighted score = Σ(criterion score × weight) ÷ available weight. All inputs visible.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Brand href="/" />
            <Link href="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Home
            </Link>
          </div>
          <LoginForm next={next} />
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Demo workspace · seeded data · <Link href="/" className="hover:underline">about OpsLedger</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
