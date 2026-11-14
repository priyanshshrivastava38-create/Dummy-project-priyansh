# Using Supabase as the Postgres database

OpsLedger talks to PostgreSQL through Prisma. Supabase can host that database; the app does **not** use Supabase Auth, the Supabase JavaScript client, Realtime, or Supabase Storage. The only value you need is a connection string.

## 1. Create the project

1. Create a project at <https://supabase.com/dashboard>. Save the database password when prompted.
2. Wait for the database to finish provisioning.

## 2. Copy the right connection string

Open **Project settings → Database → Connection string**.

Prefer the **Session pooler** URI (port `5432` on the pooler host, e.g. `aws-0-<region>.pooler.supabase.com`):

- It works over IPv4 (newer Supabase direct connections can be IPv6-only, which breaks some networks and CI runners).
- It supports prepared statements and long-lived Prisma connections.
- `prisma migrate deploy` works through it.

Avoid the **Transaction pooler** (port `6543`) unless you also add Prisma's `directUrl` configuration — this project's schema intentionally uses a single URL, and migrations are not reliable through transaction pooling.

Append `?schema=public` if the copied string does not already include a schema parameter. The final shape:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?schema=public
```

Set it as `DATABASE_URL` in `.env` (local) or in your hosting provider's environment settings.

> The URL contains the database password. Keep it in server-side environment variables only. Nothing in this app sends it to the browser.

## 3. Apply the schema and load the demo data

Run these from your machine, using the remote URL for this one command:

```bash
DATABASE_URL="postgresql://…" npx prisma migrate deploy
DATABASE_URL="postgresql://…" npm run db:seed
```

`migrate deploy` applies the committed migration in `prisma/migrations`. The seed script truncates the demo tables first, so only run it against a database you are happy to reset.

## 4. Verify

```bash
npm run dev
```

Sign in as `admin@opsledger.app` / `OpsLedger123!`, open a request, and confirm the approval timeline and audit log load. That exercises reads, joins and writes against Supabase.

## Security and operations notes

- **No service-role key is used or required.** Do not add `SUPABASE_SERVICE_ROLE_KEY` to this project; there is no code path that consumes it, and shipping it would widen the blast radius for no benefit.
- **RLS is not configured** because the database is only reachable through Prisma on the server. If you later expose PostgREST or the Supabase client to browsers, add row-level security policies first; Prisma connects as the table owner and bypasses RLS.
- **Connection limits:** free and small plans cap concurrent connections. The session pooler keeps Prisma within those limits. If you see `too many connections`, lower Prisma's pool size with `?connection_limit=1` on the URL (serverless) or move to a larger plan.
- **Pausing:** free-tier projects pause when idle; the first request after a pause may be slow or fail until the database resumes.
- **Backups:** enable the backup/PITR level you need in the Supabase dashboard before putting real data in.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Can't reach database server` | Direct host is IPv6-only on your network | Use the Session pooler host |
| `prepared statement "s0" already exists` | Transaction pooler (6543) | Switch to Session pooler (5432) |
| `remaining connection slots are reserved` | Connection spike | Add `?connection_limit=1`, reduce instances, or upgrade |
| Migrations hang | Running through transaction pooling | Use the Session pooler or a direct connection for migrations |
| `P1001` only from Vercel | Missing env var or paused project | Check the Vercel environment scope and resume the project |
