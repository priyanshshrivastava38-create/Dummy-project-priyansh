import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  FileSearch,
  FileText,
  GitBranch,
  Layers,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const modules = [
  {
    icon: FileText,
    title: "Purchase requests",
    description: "Draft, submit, revise and cancel requests with line items, budgets, priorities and required-by dates.",
  },
  {
    icon: Building2,
    title: "Vendor directory",
    description: "Searchable vendor records with contact details, compliance state, awarded value and evaluation history.",
  },
  {
    icon: FileSearch,
    title: "Quotation intake",
    description: "Upload vendor PDFs. Structured fields come back validated, confidence-scored and fully editable.",
  },
  {
    icon: Scale,
    title: "Weighted comparison",
    description: "Change price, delivery and quality weights and watch rankings recalculate from the same deterministic formula.",
  },
  {
    icon: GitBranch,
    title: "Multi-level approvals",
    description: "Spend thresholds decide the chain. Rejections need a reason. Segregation of duties is enforced server-side.",
  },
  {
    icon: BarChart3,
    title: "Spend & renewals",
    description: "Department spend, budget variance, approval bottlenecks, CSV export and contracts nearing renewal.",
  },
];

const demoAccounts = [
  { role: "Administrator", email: "admin@opsledger.app", note: "Users, policies, audit" },
  { role: "Procurement Manager", email: "procurement@opsledger.app", note: "Vendors, quotes, scoring" },
  { role: "Department Manager", email: "manager.ops@opsledger.app", note: "Approvals & requests" },
];

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-white">
      <header className="sticky top-0 z-40 border-b bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm text-zinc-600 md:flex">
            <a href="#product" className="transition-colors hover:text-zinc-950">Product</a>
            <a href="#scoring" className="transition-colors hover:text-zinc-950">Scoring</a>
            <a href="#ai" className="transition-colors hover:text-zinc-950">AI extraction</a>
            <a href="#architecture" className="transition-colors hover:text-zinc-950">Architecture</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">
                Open demo <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(243_70%_56%_/_0.10),transparent_55%)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="aurora absolute -left-24 top-8 size-[380px] rounded-full bg-indigo-300/25 blur-3xl" />
            <div className="aurora-slow absolute -right-24 -top-24 size-[430px] rounded-full bg-violet-300/20 blur-3xl" />
          </div>
          <div className="absolute inset-0 -z-10 grid-dots opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
          <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-16 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:pb-24 lg:pt-24">
            <div className="reveal">
              <Badge variant="outline" className="mb-5 gap-1.5 border-indigo-200 bg-white text-indigo-700">
                <Sparkles className="size-3" />
                Procurement decision intelligence
              </Badge>
              <h1 className="max-w-xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                Procurement{" "}
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent">
                  decisions
                </span>{" "}
                you can defend.
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-zinc-600">
                OpsLedger turns purchase requests, vendor quotations and approvals into one auditable workflow. AI reads
                the documents. Code calculates the scores. People make — and own — the decision.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="sheen">
                  <Link href="/login">
                    Explore the seeded demo <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#scoring">See the scoring model</a>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> 12 vendors, 18 requests seeded</span>
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> AI with manual fallback</span>
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> No fake integrations</span>
              </div>
            </div>

            <div className="reveal reveal-2 relative">
              <div className="absolute -inset-3 -z-10 rounded-2xl bg-gradient-to-b from-indigo-50 to-transparent" />
              <div className="overflow-hidden rounded-xl border bg-white shadow-[0_20px_60px_-24px_rgba(24,24,27,0.25)] transition-transform duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between border-b bg-zinc-50/70 px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-zinc-300" />
                    <span className="size-2 rounded-full bg-zinc-300" />
                    <span className="size-2 rounded-full bg-zinc-300" />
                  </div>
                  <span className="text-[11px] text-zinc-500">PR-2026-0042 · Hydraulic press refurbishment</span>
                  <Badge variant="violet" className="text-[10px]">Sourcing</Badge>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  {[
                    { label: "Awarded spend", value: "$182,400" },
                    { label: "Savings vs budget", value: "$17,600" },
                    { label: "Approval time", value: "2.4 days" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg border bg-white p-3">
                      <p className="text-[11px] text-zinc-500">{kpi.label}</p>
                      <p className="mt-1 text-lg font-semibold tabular">{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <p className="text-xs font-medium">Weighted vendor ranking</p>
                      <span className="text-[10px] text-zinc-500">Price 35 · Delivery 20 · Quality 20</span>
                    </div>
                    {[
                      { name: "Meridian Industrial", total: "$182,400", score: 88.4, best: true },
                      { name: "Apex Fabrication", total: "$176,950", score: 81.2 },
                      { name: "Northstar Supply", total: "$191,200", score: 72.8 },
                    ].map((vendor, index) => (
                      <div key={vendor.name} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-0">
                        <span className="w-4 text-[11px] text-zinc-400">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{vendor.name}</span>
                        {vendor.best ? <Badge variant="success" className="text-[10px]">Leader</Badge> : null}
                        <span className="w-16 text-right text-[11px] tabular text-zinc-500">{vendor.total}</span>
                        <div className="flex w-20 items-center gap-1.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`bar-grow h-full rounded-full ${vendor.best ? "bg-indigo-600" : "bg-indigo-300"}`}
                              style={{ width: `${vendor.score}%`, animationDelay: `${280 + index * 120}ms` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[11px] font-semibold tabular">{vendor.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t bg-zinc-50/60 px-4 py-2.5 text-[11px] text-zinc-500">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  Scores are deterministic. The AI summary never selects a vendor.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-b bg-zinc-50/50">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">The gap</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Procurement breaks where the paper trail stops.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                Quotations live in inboxes. Scores live in someone’s head. Approvals live in chat threads. OpsLedger
                puts the evidence, the math and the decision in the same place.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: FileSearch,
                  title: "Documents, not data",
                  body: "Vendor PDFs arrive in a dozen layouts. Details get retyped into spreadsheets, or skipped entirely.",
                },
                {
                  icon: Calculator,
                  title: "Opaque scoring",
                  body: "“Best value” is rarely defined. Weights change by deal, and no one can reproduce last quarter’s decision.",
                },
                {
                  icon: Clock3,
                  title: "Approval limbo",
                  body: "Requests sit in DMs. Rejections lose their reason. Nobody can say where the delay actually came from.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border bg-white p-5">
                  <item.icon className="size-5 text-zinc-400" />
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product */}
        <section id="product" className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">The workflow</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                One request. One comparison. One accountable decision.
              </h2>
            </div>
            <p className="max-w-sm text-sm text-zinc-600">
              Seven connected modules — not seven disconnected screens. Every status change writes to the audit trail.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <div
                key={module.title}
                className="group rounded-xl border bg-white p-5 transition-shadow hover:shadow-[0_12px_32px_-20px_rgba(24,24,27,0.35)]"
              >
                <div className="flex size-9 items-center justify-center rounded-lg border bg-zinc-50 text-zinc-600 transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                  <module.icon className="size-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{module.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{module.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Scoring */}
        <section id="scoring" className="border-y bg-zinc-950 text-zinc-100">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-400">Explainable by design</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                The score is arithmetic, not opinion.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Every criterion is normalised to 100, multiplied by an editable weight, then divided by the weights
                that actually have data. Missing information is never filled in — it lowers completeness and gets
                flagged on screen.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-300">
                {[
                  "Price: lowest total = 100; others scale by lowest ÷ quoted total.",
                  "Delivery: fastest lead time = 100; others scale by fastest ÷ days.",
                  "Quality: 70% warranty coverage (24 months = full) + 30% compliance.",
                  "Reliability: recorded delivery reliability, with no editorial adjustment.",
                  "Payment: net terms mapped transparently; unknown terms score nothing.",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-indigo-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <p className="text-xs font-medium text-zinc-300">Criterion breakdown · Meridian Industrial</p>
                <Badge className="bg-indigo-500/15 text-indigo-300">Score 88.4</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Price", weight: 35, score: 97, note: "lowest total" },
                  { label: "Delivery", weight: 20, score: 90, note: "18 days" },
                  { label: "Quality & warranty", weight: 20, score: 82, note: "24 mo · compliant" },
                  { label: "Reliability", weight: 15, score: 94, note: "94/100" },
                  { label: "Payment terms", weight: 10, score: 70, note: "Net 30" },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{row.label}</span>
                      <span className="tabular text-zinc-500">{row.weight}%</span>
                    </div>
                    <span className="row-span-2 self-center text-sm font-semibold tabular text-white">{row.score}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${row.score}%` }} />
                    </div>
                    <span className="col-span-2 text-[10px] text-zinc-500">{row.note}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                (97×35 + 90×20 + 82×20 + 94×15 + 70×10) ÷ 100 = 88.4
              </p>
            </div>
          </div>
        </section>

        {/* AI */}
        <section id="ai" className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Quotation intelligence</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Read the PDF. Show the evidence.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-600">
                Upload a vendor quotation and OpsLedger extracts structured fields with a validated schema. The original
                PDF stays attached, each value is editable, and anything missing is called out rather than invented.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { icon: Lock, title: "Never silently assume", body: "Null stays null. The UI highlights taxes, warranty or delivery that the document omits." },
                  { icon: Layers, title: "Confidence, per field", body: "Where the model reports confidence, it is shown beside the extracted value." },
                  { icon: FileSearch, title: "Source always available", body: "Open the exact PDF from the quotation to verify what supports each value." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 rounded-lg border bg-white p-3.5">
                    <item.icon className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="size-4 text-red-500" />
                  <span className="font-medium">meridian-quotation-2026.pdf</span>
                  <span className="text-zinc-400">248 KB</span>
                </div>
                <Badge variant="success" className="text-[10px]">Extracted · 92% confidence</Badge>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {[
                  { label: "Vendor", value: "Meridian Industrial Ltd", confidence: "96%" },
                  { label: "Total amount", value: "$182,400.00", confidence: "94%" },
                  { label: "Delivery", value: "18 days", confidence: "88%" },
                  { label: "Payment terms", value: "Net 30", confidence: "91%" },
                  { label: "Warranty", value: "24 months", confidence: "85%" },
                  { label: "Taxes", value: "Not stated", confidence: null, missing: true },
                ].map((field) => (
                  <div key={field.label} className={`rounded-lg border p-2.5 ${field.missing ? "border-amber-200 bg-amber-50/60" : ""}`}>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
                      <span>{field.label}</span>
                      {field.missing ? (
                        <span className="flex items-center gap-1 text-amber-700"><X className="size-3" /> Missing</span>
                      ) : (
                        <span className="tabular">{field.confidence}</span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm ${field.missing ? "italic text-amber-800" : "font-medium"}`}>{field.value}</p>
                  </div>
                ))}
              </div>
              <div className="mx-4 mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
                Manual entry is always available. If the model is unavailable, nothing is lost — the document stays
                attached and the fields are yours to fill.
              </div>
            </div>
          </div>
        </section>

        {/* Approvals + analytics */}
        <section className="border-y bg-zinc-50/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <div className="flex items-center gap-2">
                <GitBranch className="size-4 text-indigo-600" />
                <h3 className="text-sm font-semibold">Approval chains that hold up</h3>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                Policies map spend bands to levels. The department head signs first; larger purchases escalate to an
                administrator. Self-approval is blocked in the service layer, not just hidden in the UI.
              </p>
              <div className="mt-5 space-y-0">
                {[
                  { label: "Department Manager", detail: "Operations · approved in 1.2 days", state: "done" },
                  { label: "Administrator", detail: "Finance threshold ≥ $50,000 · pending", state: "current" },
                  { label: "Procurement selects vendor", detail: "Comparison & award recorded", state: "next" },
                ].map((step, index, all) => (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`mt-0.5 flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold ${step.state === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : step.state === "current" ? "border-indigo-500 bg-indigo-600 text-white" : "border-zinc-200 bg-white text-zinc-400"}`}>
                        {step.state === "done" ? <Check className="size-3.5" /> : index + 1}
                      </div>
                      {index < all.length - 1 ? <div className="h-8 w-px bg-zinc-200" /> : null}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs font-medium">{step.label}</p>
                      <p className="text-[11px] text-zinc-500">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
                Every decision records actor, timestamp, level and reason — and appears in the audit log.
              </p>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-indigo-600" />
                <h3 className="text-sm font-semibold">Numbers that close the loop</h3>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                Spend is based on selected quotations, savings only count when a real award exists, and cycle time is
                measured from submission to approval. No decorative dashboards.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  { icon: CircleDollarSign, label: "Awarded spend", value: "Selected quotations only" },
                  { icon: Clock3, label: "Average approval time", value: "Submitted → approved, per request" },
                  { icon: Users, label: "Approval bottlenecks", value: "By level, approver and days waiting" },
                  { icon: FileText, label: "CSV export", value: "Filtered, permission-checked output" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <row.icon className="size-4 text-zinc-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{row.label}</p>
                      <p className="text-[11px] text-zinc-500">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section id="architecture" className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Under the hood</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">A boring architecture, deliberately.</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                Server-rendered Next.js App Router. Typed service layer. PostgreSQL with foreign keys and indexes.
                Permission checks on the server for every mutation. No microservices, no queue you have to babysit.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Next.js App Router", "TypeScript", "PostgreSQL", "Prisma", "Zod", "Tailwind", "Recharts", "Gemini"].map((tech) => (
                  <Badge key={tech} variant="secondary">{tech}</Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, title: "Server-side RBAC", body: "Three roles, explicit permission matrix, department-scoped visibility and segregation of duties." },
                { icon: Database, title: "Integrity in the schema", body: "Foreign keys, unique vendor quotation per request, status enums and query indexes." },
                { icon: Lock, title: "Secrets stay server-side", body: "Gemini keys are read in route handlers only. Nothing sensitive reaches the browser bundle." },
                { icon: Layers, title: "Supabase-ready", body: "SQL migrations and RLS reference policies included. Swap the storage adapter without touching features." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border bg-white p-5">
                  <item.icon className="size-5 text-zinc-400" />
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo CTA */}
        <section className="border-t bg-zinc-950">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-400">Explore it now</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                A seeded workspace, three roles, zero setup.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
                18 purchase requests, 12 vendors, 20+ quotations, live approval chains and contracts approaching
                renewal. Demo records are labelled throughout.
              </p>
              <p className="mt-5 text-xs text-zinc-500">
                Password for all demo accounts: <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">OpsLedger123!</code>
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="space-y-2">
                {demoAccounts.map((account) => (
                  <div key={account.email} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{account.role}</p>
                      <p className="font-mono text-[11px] text-zinc-500">{account.email}</p>
                    </div>
                    <span className="text-[10px] text-zinc-500">{account.note}</span>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-4 w-full bg-indigo-500 hover:bg-indigo-400">
                <Link href="/login">
                  Enter the demo workspace <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-zinc-900 px-5 py-8 text-xs text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Brand className="[&_span]:text-zinc-400" />
            <span>· Portfolio build by Priyansh Shrivastava</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-zinc-300">Demo</Link>
            <a href="#architecture" className="hover:text-zinc-300">Architecture</a>
            <a href="#scoring" className="hover:text-zinc-300">Scoring</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
