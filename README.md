# NAKA Hair

NAKA Hair is a Next.js storefront with customer accounts, a separate vendor portal, vendor-owned products and orders, multi-image product galleries, and Supabase-backed authentication and storage.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 7
- Supabase Auth, Postgres, and Storage
- Vercel Functions through typed Route Handlers
- Vitest

The storefront, customer account, and vendor portal are implemented as native React components and App Router layouts. The visual language remains intentionally consistent with the original site. Proven server-side commerce and vendor rules remain under `legacy/api` behind a bounded adapter while those CommonJS handlers are converted incrementally to typed modules.

## Architecture

```text
Browser (customer or vendor session)
        │ HTTPS + Supabase access token
        ▼
Next.js App Router
  ├─ static storefront and role-specific pages
  └─ /api Route Handlers
       ├─ request validation and body limits
       ├─ authentication and ownership checks
       ├─ rate limiting and structured errors
       └─ server-only data access
                    │ service credential (never sent to the browser)
                    ▼
Supabase
  ├─ Auth
  ├─ Postgres + RLS + explicit grants
  ├─ atomic checkout RPC
  └─ product image Storage
```

Route Handlers are the security boundary. The browser does not choose roles, owners, prices, or order totals. Product pricing is recalculated server-side, vendor access is derived from the authenticated user, and checkout creates the customer order, vendor fulfilments, and stock updates in one database transaction. A client-generated idempotency key makes checkout retries safe.

## Requirements

- Node.js 22 or later
- npm
- A Supabase project with the migrations in `supabase/migrations`

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The lightweight liveness endpoint is available at `/api/health`. API failures include an `x-request-id` response header and emit structured JSON logs suitable for Vercel Runtime Logs or a log drain.

## Project layout

```text
app/                  App Router layouts, pages, global styles, and Route Handlers
components/           Native React UI grouped by store, account, vendor, and providers
legacy/api/           Validated commerce and vendor handlers pending TypeScript conversion
lib/client/           Typed browser models, pricing helpers, and Supabase client setup
lib/server/           Server-only API and data-access helpers
public/               Static product assets
supabase/migrations/  Database and storage migrations
tests/                Vitest coverage
```

## Environment variables

Set all variables from `.env.example` in Vercel. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and marked sensitive. Public variables are embedded into the browser bundle during the build.

Apply database migrations before deploying application code that depends on them:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Use separate Supabase projects for local/development, preview, and production where possible. Database changes should be promoted through migrations rather than edited directly in the dashboard.

Customer and vendor capabilities remain separate: becoming a vendor does not replace the customer profile role, and every vendor product/order operation is ownership-scoped on the server.

## Security and operations

- Server credentials are read only by modules marked `server-only`.
- Mutable and personal API responses use `Cache-Control: no-store`.
- Requests have bounded bodies and upstream calls have timeouts.
- Public contact, tracking, and checkout endpoints use database-backed rate limits.
- Security headers prevent MIME sniffing, framing, unnecessary browser capabilities, and downgrade access.
- Supabase functions use an empty `search_path`, minimal execute grants, and explicit table privileges.

The previous inline storefront script and custom legacy admin console have been removed from active routes. Administrative workflows should be introduced only through authenticated Supabase sessions and server-side `requireAdmin` authorization rather than restoring the old custom-token implementation.
