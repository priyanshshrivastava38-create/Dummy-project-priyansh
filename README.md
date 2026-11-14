# OpsLedger

Procurement and vendor decision intelligence for small and mid-sized organisations. Purchase requests, vendors, quotation extraction, weighted comparison, multi-level approvals, spend analytics, contracts and a full audit trail — in one Next.js application.

Every screen is backed by real PostgreSQL records, server-enforced permissions and deterministic scoring. AI is used only where it helps: reading quotation PDFs into editable fields and writing a plain-language comparison summary. It never ranks vendors, approves requests or selects an award.

- **Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS v4, Prisma 6, PostgreSQL
- **AI:** Google Gemini REST API (primary) or a local Ollama model, selected server-side
- **Demo data:** one seeded organisation, "Northwind Industrial", clearly marked as a demo environment

## Quick start

Requires Node.js 20+ and a PostgreSQL server you can create a database in.

```bash
# 1. Install
npm install

# 2. Configure
createdb opsledger            # if the database does not exist yet
cp .env.example .env
#    - point DATABASE_URL at your Postgres role and database
#    - set AUTH_SECRET to a 32-byte random string:  openssl rand -base64 32

# 3. Create the schema and load the demo dataset
npx prisma migrate deploy
npm run db:seed

# 4. Run (the app is pinned to port 3100)
npm run dev
```

Open <http://localhost:3100> and sign in.

### Demo accounts

All seeded accounts share the password **`OpsLedger123!`**.

| Role | Email | What it shows |
| --- | --- | --- |
| Administrator | `admin@opsledger.app` | Everything, including settings, audit log and acting as a fallback approver |
| Procurement Manager | `procurement@opsledger.app` | Sourcing, vendors, quotations, comparison, contracts — cannot approve |
| Department Manager | `manager.ops@opsledger.app` | Own requests plus the approval queue |

Additional users (`buyer@`, `manager.it@`, `manager.finance@`, …) exist so approval routing and segregation of duties are visible. The seed script prints the full list.

## What you can do

| Area | Route | Highlights |
| --- | --- | --- |
| Executive overview (A) | `/dashboard` | Spend and cycle KPIs, pending approvals, expiring contracts, recent activity. KPI cards link to the underlying lists, and a "Needs attention" strip jumps straight to approvals, renewals, compliance gaps and drafts. |
| Purchase requests (B) | `/requests` | DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED → SOURCING → COMPLETED, plus cancel and revision. Line items, budget, priority, department, documents, comments. |
| Vendors (C) | `/vendors` | Directory and detail pages with contacts, compliance, performance rating, delivery reliability, awarded spend and quotation history. |
| Quotation capture (D) | request detail | Upload a PDF for AI extraction into editable fields, keep the original document, or enter a quotation manually. Confidence and missing values are visible before saving. |
| Comparison (E) | `/requests/[id]/compare` | Configurable weights, reproducible scores, per-criterion breakdown, strengths/weaknesses, an AI-written explanation on request. Selecting a winner is a separate, permissioned action. |
| Approvals (F) | `/approvals` | Amount-banded, multi-level approval chain. Approve, reject (reason required), or request clarification. No self-approval; admins can unblock, never approve their own request. |
| Analytics (G) | `/analytics` | Date-filtered spend by department/category, cycle time, vendor concentration, CSV export. |
| Contracts (H) | `/contracts` | Term dates, renewal dates, document link, renewal risk derived from dates (not typed in), 12-month renewal action. |
| Administration | `/settings`, `/audit` | Users, departments, approval policies, scoring weights; append-only audit trail with before/after snapshots. |

Quality-of-life interactions: a `⌘K` / `Ctrl+K` (or `/`) command palette with live search across requests, vendors and contracts; an "Ask OpsLedger" launcher on the dashboard and sidebar that opens that same palette; a `?` help dialog with keyboard shortcuts and a map of where things live; clickable table rows; removable, shareable filter chips; breadcrumbs; copy-reference buttons; keyboard-accessible dialogs.

Motion: count-up KPI values, staggered page and card reveals, a slow ambient gradient behind the workspace, animated chart entrances, and a typewriter reveal for the AI narrative summary (generation shows a shimmer while the model works). Every animation is CSS or rAF-driven and is disabled under `prefers-reduced-motion`, and animations fall back to their final state when the tab is hidden.

Layout: a dark, gradient workspace sidebar on desktop that becomes a slide-over sheet below `lg`, sticky topbar with the active role, and list pages that switch from tables to touch-sized cards under `md`. A "Needs attention" strip on the dashboard turns open work into one-click filtered views.

## Architecture

```
src/
  app/
    (app)/            authenticated routes (dashboard, requests, vendors, …)
    (auth)/           login and signup
    actions/          Server Actions — thin controllers that call services
    api/              live search, CSV export, document downloads, AI summary
  components/
    app/              feature components (forms, dialogs, filters, palette)
    ui/               design-system primitives (Radix + Tailwind)
  lib/
    services/         all database access; authorises, scopes by org, records activity/audit
    approvals/        pure approval-plan resolver (who signs off, in what order)
    scoring/          pure deterministic scoring engine
    ai/               provider abstraction, prompt, extraction and Zod normalisation
    auth.ts           session creation/validation, requireUser/requirePermission
    permissions.ts    role → permission matrix and segregation-of-duties rules
prisma/
  schema.prisma       data model (snake_case tables)
  migrations/         committed SQL migrations
  seed.ts             idempotent demo dataset (truncates and rebuilds)
tests/                33 node:test cases for scoring, approvals, permissions, schemas
```

Server Actions validate input with Zod, call a service, and return a typed `ActionResult`. Services always re-check permissions and scope queries to the caller's organisation — a hidden button is never the only control. Pages run through the same `requireUser` / `requirePermission` guards.

### Roles and permissions

| Permission | Administrator | Procurement Manager | Department Manager |
| --- | :-: | :-: | :-: |
| Create / submit / cancel own requests | ✓ | ✓ | ✓ |
| Read all requests | ✓ | ✓ | own only |
| Manage vendors | ✓ | ✓ | read only |
| Manage and extract quotations | ✓ | ✓ | read only |
| Select a quotation | ✓ | ✓ | — |
| Approve / reject / clarify | ✓ (not own) | — | assigned steps |
| Read contracts | ✓ | ✓ | ✓ |
| Create / renew contracts | ✓ | ✓ | — |
| Analytics | ✓ | ✓ | ✓ |
| Settings and audit log | ✓ | — | — |

Segregation of duties is enforced in `canDecideApproval`: a request's requester can never decide its approval, and an approver can only act on a step assigned to them (administrators may act as a fallback on steps that are not their own).

## Deterministic scoring, AI explanation only

`src/lib/scoring/engine.ts` is pure TypeScript with no AI or randomness:

- Default weights: price 35, delivery 20, quality 20, reliability 15, payment 10 (editable in settings, must total 100).
- Each criterion produces a 0–100 score with its own explanation string.
- Missing data is never assumed. A criterion with no underlying value is excluded, and the remaining weights are renormalised so the total still scores out of 100. The scorecard labels every missing input.
- Ties, cost deltas and rank are reproducible from the stored quotation and vendor records.
- The AI summary receives the already-computed scores and can only describe them. Award selection is a guarded, explicit action.

## Approvals

- `src/lib/approvals/plan.ts` picks the matching amount band (e.g. standard, elevated, executive) and builds a one- or two-level chain from the department approver, then an administrator or procurement manager.
- The requester is never placed in their own approval chain.
- Rejections require a reason (minimum 5 characters); clarification requests require a short explanation, move the request back to an editable state, and are recorded with timestamps.
- Every decision writes an `ApprovalAction`, an `Activity` feed entry and an `AuditLog` row containing before/after state.

## AI configuration

The app is fully usable without any AI provider — quotations can always be entered manually.

```bash
# Primary: Google Gemini
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-2.5-flash"

# Alternative: local Ollama (used only when GEMINI_API_KEY is empty)
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen2.5:3b"
```

Keys are read only in Server Actions and route handlers. Nothing AI-related is exposed to the browser; requests to Gemini are made from the server. See [docs/gemini.md](docs/gemini.md) for setup, request shape and failure behaviour.

Extraction flow: PDF text is read with `unpdf` → the model is asked for a fixed JSON shape → the response is parsed, normalised and validated with Zod → fields, confidence notes and missing values are shown in an editable dialog → the user saves. The uploaded PDF is preserved alongside the imported values, and a failed extraction leaves the manual editor available instead of writing partial data.

## Document storage

This build ships a local-disk adapter (`src/lib/storage.ts`) that writes under `STORAGE_LOCAL_DIR` (default `storage/`). Uploads are limited to real `%PDF-` files of at most 10 MB.

`STORAGE_DRIVER` only accepts `local`; any other value fails loudly at write time rather than silently pretending an integration exists. An object-storage adapter needs to implement `putObject`, `getObject` and `removeObject` with the same key format. On serverless platforms such as Vercel the filesystem is read-only, so document upload requires that adapter — see [docs/vercel.md](docs/vercel.md).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string used by Prisma for runtime and migrations |
| `AUTH_SECRET` | yes | HMAC key for session tokens (32-byte random string; sessions are invalidated if it changes) |
| `GEMINI_API_KEY` | no | Enables AI extraction and summaries |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash` |
| `OLLAMA_BASE_URL` | no | Local model fallback when Gemini is not configured |
| `OLLAMA_MODEL` | no | Defaults to `qwen2.5:3b` |
| `STORAGE_DRIVER` | no | `local` (only implemented driver) |
| `STORAGE_LOCAL_DIR` | no | Upload directory, default `storage` |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3100 |
| `npm run build` / `npm start` | Production build and server (also port 3100) |
| `npm test` | 33 unit tests over scoring, approvals, permissions and validation schemas |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js config) |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply committed migrations (production) |
| `npm run db:seed` | Rebuild the demo dataset |
| `npm run db:reset` | Drop, migrate and reseed the local database |

## Demo dataset

The seed script truncates the demo tables and rebuilds one complete organisation:

- 5 departments, 11 users across all three roles
- 14 vendors with compliance states, ratings and delivery reliability
- 18 purchase requests across every status
- 21 quotations (6 with generated PDF documents) and 10 vendor evaluations
- 8 contracts, including expiring and expired agreements
- 112 activity entries and 86 audit entries

The workspace is labelled as demo data in the top bar, and the organisation row carries `demoMode`. Re-running `db:seed` resets everything, so don't point it at a database with data you want to keep.

## Verification status

On the current commit:

- `npm test` — 33/33 passing
- `npm run typecheck` — clean
- `npm run lint` — 0 errors, 4 warnings (React Compiler notices for React Hook Form's `watch`, plus one PostCSS config notice)
- `npm run build` — production build succeeds for every route
- Manual browser checks — sign-in, dashboard, request lifecycle, vendor/contract detail, comparison, approvals, analytics, settings, audit, `⌘K` palette with live search, `?` help dialog, filter chips and row navigation, dashboard attention tiles landing on filtered lists, and card lists replacing tables at narrow widths

No deployment is claimed here. [docs/vercel.md](docs/vercel.md) contains the deployment steps and the storage caveat.

## Security notes

- Passwords are hashed with bcrypt (cost 12). Sessions are opaque random tokens; only an HMAC digest is stored in the database, with a 7-day expiry. The cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
- Middleware performs a cheap redirect for requests without a session cookie; the authoritative check is the database lookup in `requireUser` / `requireApiUser`.
- Every service filters by the caller's `orgId`, so cross-organisation IDs cannot be read. Every mutating action re-checks the specific permission it needs.
- File uploads are checked by extension, MIME type and `%PDF-` magic bytes; storage keys are generated server-side and path traversal is rejected.
- No service-role keys, database credentials or AI keys are shipped to the client. There is no Supabase client library in this app.
- Audit entries are append-only by application design: no update or delete path exists. This is not a database trigger, so direct SQL access could still alter rows.

## Known limitations

- **No OCR.** Scanned/image-only PDFs yield little or no text; the UI reports that instead of guessing values.
- **No email or invitation delivery.** Users are created in Settings and credentials are shared out of band. Self-service signup joins the existing demo workspace as a Department Manager (Approver); it does not create a new organisation.
- **Local document storage only** (see above).
- **Single organisation per account.** Multi-tenant switching is not part of this build; every query is already scoped by organisation to keep that door open.
- **AI is optional.** With no provider configured, extraction and AI summaries are disabled with an explanatory message; scoring, approvals and every other workflow remain fully functional.

## Guides

- [Supabase Postgres setup](docs/supabase.md)
- [Gemini and Ollama setup](docs/gemini.md)
- [Vercel deployment](docs/vercel.md)
